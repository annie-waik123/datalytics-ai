import { NextResponse } from 'next/server';
const pdfParse = require('pdf-parse');

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'PDF upload requires multipart/form-data.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No PDF file uploaded.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await pdfParse(buffer);
    
    const lines = data.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const jsonData = lines.slice(0, 50).map((line, index) => ({
      Row: index + 1,
      Content: line
    }));

    return NextResponse.json({
      success: true,
      data: jsonData
    });
  } catch (error) {
    console.error('PDF Parsing Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process PDF data. ' + error.message 
    }, { status: 500 });
  }
}
