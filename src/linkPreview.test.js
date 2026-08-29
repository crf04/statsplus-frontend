import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_TITLE, applyLinkPreview, linkPreviewFor } from './linkPreview';

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('linkPreviewFor', () => {
  test('names the player and the filters a link carries', () => {
    const preview = linkPreviewFor(
      new URLSearchParams(
        'player_name=LeBron+James&season_filter=2024-25&game_filter=10&location_filter=Home&teams_against[]=BOS&rank_filter[]=30',
      ),
    );

    expect(preview).toEqual({
      title: 'LeBron James Game Logs | CourtAI',
      description:
        'LeBron James NBA game logs: 2024-25 season, last 10 games, home games, vs BOS. Explore on CourtAI.',
    });
  });

  test('describes a bare player link as every logged game', () => {
    expect(linkPreviewFor(new URLSearchParams('player_name=Stephen+Curry'))).toEqual({
      title: 'Stephen Curry Game Logs | CourtAI',
      description: 'Stephen Curry NBA game logs: every logged game. Explore on CourtAI.',
    });
  });

  test('has nothing to say without a player', () => {
    expect(linkPreviewFor(new URLSearchParams(''))).toBeNull();
    expect(linkPreviewFor(new URLSearchParams('browse&season_filter=2024-25'))).toBeNull();
  });

  test('has nothing to say for a link the Workspace refuses', () => {
    expect(
      linkPreviewFor(new URLSearchParams('player_name=LeBron+James&season_filter=2024-26')),
    ).toBeNull();
  });
});

describe('applyLinkPreview', () => {
  const preview = {
    title: 'Luka "Magic" Dončić Game Logs | CourtAI',
    description: 'Luka Dončić NBA game logs: vs BOS & MIA. Explore on CourtAI.',
  };
  // Prettier wraps long tags across lines; collapse so assertions read one tag per line.
  const html = applyLinkPreview(indexHtml, preview).replace(/\s+/g, ' ');

  test('rewrites every title and description the static head declares', () => {
    expect(indexHtml).toContain(`<title>${DEFAULT_TITLE}</title>`);
    expect(html).toContain('<title>Luka &quot;Magic&quot; Dončić Game Logs | CourtAI</title>');
    expect(html).not.toContain(DEFAULT_TITLE);
    expect(html).toContain(
      '<meta property="og:title" content="Luka &quot;Magic&quot; Dončić Game Logs | CourtAI" />',
    );
    expect(html).toContain(
      '<meta name="twitter:title" content="Luka &quot;Magic&quot; Dončić Game Logs | CourtAI" />',
    );
    for (const attribute of [
      'name="description"',
      'property="og:description"',
      'name="twitter:description"',
    ]) {
      expect(html).toContain(
        `<meta ${attribute} content="Luka Dončić NBA game logs: vs BOS &amp; MIA. Explore on CourtAI." />`,
      );
    }
    expect(html).not.toContain('CourtAI helps explore');
  });

  test('leaves the rest of the document alone', () => {
    expect(html).toContain('<script type="module" src="/src/index.js"></script>');
    expect(html).toContain(
      '<meta property="og:image" content="https://courtai.app/logo512.png" />',
    );
  });
});
