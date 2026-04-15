import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

import { createSupabaseServerClient } from '@/lib/supabase';

type PdfParseResult = { text: string };
type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;
type PdfParseModule = { default?: PdfParseFn } & PdfParseFn;
type UploadResult = { id: string; filename: string; size: string };
type UploadFailure = { filename: string; error: string };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEXT_FILE_TYPES = new Set(['text/plain', 'text/markdown']);

function isDocxFile(file: File) {
  return file.type.includes('wordprocessingml.document');
}

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf') {
    const pdfModule = (await import('pdf-parse')) as unknown as PdfParseModule;
    const pdfParse = pdfModule.default ?? pdfModule;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (isDocxFile(file)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (TEXT_FILE_TYPES.has(file.type)) {
    return buffer.toString('utf-8');
  }

  return '';
}

export async function POST(req: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await req.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid upload payload';

    return NextResponse.json(
      {
        error:
          message === 'Failed to parse body as FormData.'
            ? 'Upload payload could not be parsed. Try a smaller batch or re-upload the files.'
            : message,
      },
      { status: 400 },
    );
  }

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const results: UploadResult[] = [];
  const failures: UploadFailure[] = [];

  for (const file of files) {
    try {
      const text = (await extractText(file)).trim();

      if (!text) {
        failures.push({
          filename: file.name,
          error: 'Unsupported file type or no readable text found.',
        });
        continue;
      }

      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename: file.name,
          content: text,
        })
        .select('id')
        .single();

      if (docError || !doc) {
        console.error('Insert error:', file.name, docError);
        failures.push({
          filename: file.name,
          error: 'Could not save document metadata.',
        });
        continue;
      }

      const chunks = text.match(/[\s\S]{1,800}/g) ?? [];

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i].trim();

        if (!chunk) {
          continue;
        }

        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: chunk,
        });

        const { error: embeddingError } = await supabase.from('document_embeddings').insert({
          document_id: doc.id,
          content: chunk,
          chunk_index: i,
          embedding,
        });

        if (embeddingError) {
          console.error('Embedding insert error:', file.name, embeddingError);
          throw new Error('Could not save document embeddings.');
        }
      }

      results.push({
        id: doc.id,
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected upload error';
      console.error('Upload error:', file.name, message);
      failures.push({
        filename: file.name,
        error: message,
      });
    }
  }

  return NextResponse.json(
    {
      success: results.length > 0,
      documents: results,
      failures,
    },
    { status: results.length > 0 ? 200 : 400 },
  );
}
