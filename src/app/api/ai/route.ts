import { NextResponse } from 'next/server';
import { aiService } from '@/services/ai';

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();
    
    switch (action) {
      case 'validate':
        const validationResult = await aiService.validate(data.content, data.type);
        return NextResponse.json({ result: validationResult });
      
      case 'search':
        const searchResult = await aiService.search(data.query, data.content);
        return NextResponse.json({ result: searchResult });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}