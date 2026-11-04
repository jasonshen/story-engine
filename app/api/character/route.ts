import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const SYSTEM = `You write short character sketches for fiction writers. You get a character's psychological anatomy: a wound, the belief it produced, the strategy that belief drives, what that strategy buys and costs them, how they behave day to day, when they want something, when the wound is poked, when the armor slips, and the arc they are headed for.

Write one paragraph of 4-6 sentences that makes this a specific, living person. Invent a name, an age, an occupation and one concrete detail of their daily life that the strategy shapes. Show the traits through behavior rather than listing them. Let the payoff and the cost both be visible. End on a hint of the arc without resolving it. Use every element you're given and contradict none of them. No headings, no preamble: output only the paragraph.`;

export async function POST(request: NextRequest) {
  try {
    const { elements } = await request.json();
    if (!elements || typeof elements !== 'string') {
      return NextResponse.json({ error: 'Missing elements' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      // If a safety classifier declines, retry server-side on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: 'Character anatomy:\n\n' + elements }],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'The model declined to sketch this one. Try a re-roll.' },
        { status: 422 }
      );
    }

    const sketch = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!sketch) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
    }
    return NextResponse.json({ sketch });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limited. Try again in a moment.' },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return NextResponse.json(
        { error: 'Sketch engine unavailable' },
        { status: 502 }
      );
    }
    console.error('Character sketch error:', error);
    return NextResponse.json(
      { error: 'Sketch engine unavailable' },
      { status: 500 }
    );
  }
}
