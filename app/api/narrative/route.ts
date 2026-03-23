import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { elements } = await request.json();

    if (!elements) {
      return NextResponse.json(
        { error: 'Missing elements' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:
          'You are a story concept writer specializing in science fiction and fantasy. Write a tight 2-3 sentence story concept pitch using ONLY the provided elements. Do not add anything not in the input. Sci-fi/fantasy tone. Be specific, evocative. Output ONLY the pitch.',
        messages: [
          {
            role: 'user',
            content: 'Story elements:\n\n' + elements,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.content) {
      const narrative = data.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n')
        .trim();
      return NextResponse.json({ narrative });
    }

    return NextResponse.json(
      { error: 'Generation failed' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Narrative generation error:', error);
    return NextResponse.json(
      { error: 'Narrative engine unavailable' },
      { status: 500 }
    );
  }
}
