import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function POST(request) {
  let client;
  try {
    const body = await request.json();
    const { host, database, table, username, password } = body;

    if (!host || !database || !table) {
      return NextResponse.json({ success: false, error: 'Host, Database, and Collection (table) are required.' }, { status: 400 });
    }

    // Construct URI
    let uri = host;
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      if (username && password) {
        uri = `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}`;
      } else {
        uri = `mongodb://${host}`;
      }
    }

    // Initialize MongoClient
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout
    });

    await client.connect();

    const db = client.db(database);
    const collection = db.collection(table);

    // Fetch first 50 documents
    const documents = await collection.find({}).limit(50).toArray();

    // Remove _id or convert it to string so it serializes properly
    const sanitizedData = documents.map(doc => {
      if (doc._id) {
        doc._id = doc._id.toString();
      }
      return doc;
    });

    return NextResponse.json({
      success: true,
      data: sanitizedData
    });
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to connect to MongoDB. ' + error.message 
    }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
