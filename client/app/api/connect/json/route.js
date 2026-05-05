import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let jsonData = [];

    // Mode 1: File Upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return NextResponse.json({ success: false, error: 'No JSON file uploaded.' }, { status: 400 });
      }

      const fileText = await file.text();
      try {
        const parsedData = JSON.parse(fileText);
        if (Array.isArray(parsedData)) {
          jsonData = parsedData;
        } else if (parsedData.data && Array.isArray(parsedData.data)) {
          jsonData = parsedData.data;
        } else if (parsedData.items && Array.isArray(parsedData.items)) {
          jsonData = parsedData.items;
        } else {
          jsonData = [parsedData];
        }
      } catch (err) {
        return NextResponse.json({ success: false, error: 'Uploaded file contains invalid JSON structure.' }, { status: 400 });
      }

    // Mode 2: URL Endpoint
    } else {
      const body = await request.json();
      const { url } = body;

      if (!url) {
        return NextResponse.json({ success: false, error: 'API Endpoint URL is required.' }, { status: 400 });
      }

      try {
        const response = await axios.get(url, { timeout: 10000 });
        const apiData = response.data;

        if (Array.isArray(apiData)) {
          jsonData = apiData;
        } else if (apiData.data && Array.isArray(apiData.data)) {
          jsonData = apiData.data;
        } else if (apiData.items && Array.isArray(apiData.items)) {
          jsonData = apiData.items;
        } else {
          jsonData = [apiData]; 
        }
      } catch (err) {
        return NextResponse.json({ success: false, error: 'Failed to fetch from the provided URL. Ensure it is public and returns valid JSON.' }, { status: 400 });
      }
    }

    // Return exactly up to 50 records
    const slicedData = jsonData.slice(0, 50);

    return NextResponse.json({
      success: true,
      data: slicedData
    });
  } catch (error) {
    console.error('JSON Connection Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process JSON data. ' + error.message 
    }, { status: 500 });
  }
}
