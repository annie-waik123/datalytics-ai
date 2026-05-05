import { NextResponse } from 'next/server';
import axios from 'axios';
import csv from 'csv-parser';
import { Readable } from 'stream';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'Google Sheet URL is required.' }, { status: 400 });
    }

    // Extract Sheet ID
    // Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      return NextResponse.json({ success: false, error: 'Invalid Google Sheet URL. Could not extract Sheet ID.' }, { status: 400 });
    }

    const sheetId = match[1];

    // Create CSV export URL using the more robust Visualization API endpoint
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    // Fetch CSV
    const response = await axios.get(csvUrl, { responseType: 'text' });
    const csvData = response.data;

    // Convert CSV to JSON using csv-parser
    const results = [];
    const stream = Readable.from([csvData]);

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          // Limit to 50 rows as requested
          if (results.length < 50) {
            results.push(data);
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Google Sheets Connection Error:', error.message);
    const apiError = error.response ? `HTTP ${error.response.status}` : error.message;
    return NextResponse.json({ 
      success: false, 
      error: `Failed to fetch Google Sheet (${apiError}). Please ensure the sheet is truly public (Anyone with link -> Viewer).` 
    }, { status: 500 });
  }
}
