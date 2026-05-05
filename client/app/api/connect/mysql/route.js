import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request) {
  let connection;
  try {
    const body = await request.json();
    const { host, port, database, username, password, table } = body;

    if (!host || !database || !username) {
      return NextResponse.json({ success: false, error: 'Host, Database, and Username are required.' }, { status: 400 });
    }

    // Initialize connection
    connection = await mysql.createConnection({
      host,
      port: port ? parseInt(port) : 3306,
      user: username,
      password,
      database,
      connectTimeout: 5000 // 5 seconds timeout
    });

    let targetTable = table;

    // If no table is provided, fetch the first available table
    if (!targetTable) {
      const [tables] = await connection.execute('SHOW TABLES');
      if (tables.length === 0) {
        return NextResponse.json({ success: false, error: 'No tables found in the database.' }, { status: 400 });
      }
      const tableColumn = Object.keys(tables[0])[0];
      targetTable = tables[0][tableColumn];
    }

    // Fetch first 50 documents
    const [rows] = await connection.execute(`SELECT * FROM \`${targetTable}\` LIMIT 50`);

    return NextResponse.json({
      success: true,
      table: targetTable,
      data: rows
    });
  } catch (error) {
    console.error('MySQL Connection Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to connect to MySQL. ' + error.message 
    }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
