/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Question: should the home page preview Matchups and Targets, and how?
 * Four layouts on the real home (`/`), switchable via `#proto=home&v=…`.
 * The real hero (court, headline, search) and the query ladder are passed in
 * untouched; each variant decides where they and the previews sit.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PrototypeSwitcher from './PrototypeSwitcher';
import { DEMO_DATE } from './prototypeMode';
import {
  bestEdgeInGame,
  biggestPtsEffects,
  topEdges,
  useHomePreviewData,
} from './useHomePreviewData';
import {
  EdgeRow,
  EdgeValue,
  GameTile,
  ProtoLink,
  SectionHead,
  TargetCard,
  gameLabel,
  pct,
  lastName,
  qualifierText,
  shortName,
  tipoff,
} from './parts';
import hooks from './mock/hooks.json';
import {
  AnswerLadder,
  LadderPath,
  LadderRows,
  SavedRail,
  SlimSpot,
  Spotlight,
  SpotlightCard,
} from './hooks';
import { VariantT, VariantU, VariantV, VariantW, VariantX } from './tonightFirst';
import './prototype.css';

const slateDay = new Date(`${DEMO_DATE}T12:00:00`).toLocaleDateString([], {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const Loading = () => <p className="hp-loading">Loading tonight…</p>;

/* A: the ask — two Targets in a sidebar, a slate strip under the search. */
const VariantA = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  const targetsBlock = (
    <>
      <SectionHead
        kicker="Your Targets"
        title={targets ? `${targets.firing.length} firing tonight` : 'Firing tonight'}
        to="/targets"
        cta="All"
      />
      {targets ? (
        <>
          {targets.firing.slice(0, 2).map((entry) => (
            <TargetCard key={entry.target.id} entry={entry} />
          ))}
          {targets.firing.length > 2 && (
            <ProtoLink to="/targets" className="hp-side-more">
              +{targets.firing.length - 2} more firing · {targets.total - targets.firing.length}{' '}
              idle
            </ProtoLink>
          )}
        </>
      ) : (
        <Loading />
      )}
    </>
  );
  return (
    <div className="hp-a">
      <div className="hp-a-main">
        {hero}
        <section className="hp-a-strip" aria-label="Tonight's slate">
          <SectionHead
            kicker={slateDay}
            title={slate ? `Tonight · ${slate.games.length} games` : 'Tonight'}
            to="/matchups"
            cta="All matchups"
          />
          {slate ? (
            <div className="hp-strip-scroll">
              {slate.games.map((game) => (
                <GameTile key={game.gameId} game={game} edge={bestEdgeInGame(game.gameId)} />
              ))}
            </div>
          ) : (
            <Loading />
          )}
        </section>
        {/* Phone: the sidebar has nowhere to sit, so it follows the strip. */}
        <section className="hp-a-inline" aria-label="Your Targets tonight">
          {targetsBlock}
        </section>
        {ladder}
      </div>
      <aside className="hp-a-side" aria-label="Your Targets tonight">
        {targetsBlock}
      </aside>
    </div>
  );
};

/* B: hero untouched; a "Tonight" board (scoreboard + Targets) right under it. */
const VariantB = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  return (
    <div className="hp-b">
      <div className="landing-container">{hero}</div>
      <section className="hp-b-board" aria-label="Tonight">
        <div className="hp-b-col">
          <SectionHead
            kicker={slateDay}
            title="Tonight's slate"
            to="/matchups"
            cta="Open Matchups"
          />
          {slate ? (
            <ol className="hp-scoreboard">
              {slate.games.map((game) => {
                const edge = bestEdgeInGame(game.gameId);
                return (
                  <li key={game.gameId}>
                    <ProtoLink to={`/matchups/${game.gameId}`} className="hp-sb-row">
                      <span className="hp-sb-time">{tipoff(game.scheduledAt)}</span>
                      <span className="hp-sb-teams">{gameLabel(game)}</span>
                      {edge && (
                        <span className="hp-sb-edge">
                          <span>{shortName(edge.name)}</span>
                          <EdgeValue value={edge.value} market={edge.market} />
                        </span>
                      )}
                    </ProtoLink>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Loading />
          )}
        </div>
        <div className="hp-b-col hp-b-targets">
          <SectionHead
            kicker="Your Targets"
            title={targets ? `${targets.firing.length} of ${targets.total} firing` : 'Firing'}
            to="/targets"
            cta="All Targets"
          />
          {targets ? (
            targets.firing
              .slice(0, 2)
              .map((entry) => <TargetCard key={entry.target.id} entry={entry} />)
          ) : (
            <Loading />
          )}
        </div>
      </section>
      <div className="landing-container">{ladder}</div>
    </div>
  );
};

/* C: least intrusion — a scoreboard ticker above, Target pills under search. */
const VariantC = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  return (
    <div className="hp-c">
      <div className="hp-ticker" aria-label="Tonight's slate">
        <ProtoLink to="/matchups" className="hp-ticker-label">
          {slateDay}
          <b>{slate ? slate.games.length : '–'} games</b>
        </ProtoLink>
        <div className="hp-ticker-track">
          {slate?.games.map((game) => {
            const edge = bestEdgeInGame(game.gameId);
            return (
              <ProtoLink key={game.gameId} to={`/matchups/${game.gameId}`} className="hp-tick">
                <span className="hp-tick-teams">{gameLabel(game)}</span>
                <span className="hp-tick-time">{tipoff(game.scheduledAt)}</span>
                {edge && (
                  <span className="hp-tick-edge">
                    {edge.name.split(' ').slice(-1)[0]}{' '}
                    <EdgeValue value={edge.value} market={edge.market} />
                  </span>
                )}
              </ProtoLink>
            );
          })}
        </div>
      </div>
      <div className="landing-container">
        {hero}
        {targets && targets.firing.length > 0 && (
          <div className="hp-c-pills" aria-label="Your Targets firing tonight">
            <span className="hp-c-pills-label">Firing tonight</span>
            {targets.firing.slice(0, 2).map((entry) => (
              <ProtoLink
                key={entry.target.id}
                to={`/targets/${entry.target.id}`}
                className="hp-pill"
              >
                <span className="hp-opp">vs {entry.target.opponent}</span>
                <span className="hp-pill-crit">
                  {entry.target.qualifiers.map(qualifierText).join(' · ')}
                </span>
                <span className="hp-pill-count">{entry.players.length}</span>
              </ProtoLink>
            ))}
            {targets.firing.length > 2 && (
              <ProtoLink to="/targets" className="hp-pill hp-pill-more">
                +{targets.firing.length - 2}
              </ProtoLink>
            )}
          </div>
        )}
        {ladder}
      </div>
    </div>
  );
};

/* D: depth over breadth — one featured game as a mini Matchup, with the
   Targets that fire in it, then the rest of the slate as chips. */
const VariantD = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  const [open, setOpen] = useState(false);
  // Feature the game with the strongest PTS matchups on both sides; each
  // Target firing in it adds weight.
  const weight = (game) =>
    [game.away.tricode, game.home.tricode]
      .flatMap((tricode) => topEdges(game.gameId, { tricode }))
      .reduce((sum, player) => sum + player.value, 0) +
    (targets ? targets.firing.filter((t) => t.game.gameId === game.gameId).length * 0.05 : 0);
  const featured = slate ? [...slate.games].sort((a, b) => weight(b) - weight(a))[0] : null;
  const featuredTargets =
    featured && targets ? targets.firing.filter((t) => t.game.gameId === featured.gameId) : [];
  const rest = slate ? slate.games.filter((game) => game !== featured) : [];
  return (
    <div className="hp-d">
      <div className="landing-container">{hero}</div>
      <section className="hp-d-feature" aria-label="Game of the night">
        {featured ? (
          <>
            <div className="hp-d-head">
              <div>
                <span className="hp-kicker">Game of the night · {slateDay}</span>
                <h2 className="hp-d-title">
                  {featured.away.tricode} <i>@</i> {featured.home.tricode}
                  <small>{tipoff(featured.scheduledAt)}</small>
                </h2>
              </div>
              <ProtoLink to={`/matchups/${featured.gameId}`} className="hp-d-open">
                Open Matchup
              </ProtoLink>
            </div>
            <div className="hp-d-sides">
              {[featured.away, featured.home].map((team) => (
                <div key={team.tricode} className="hp-d-side">
                  <h3>
                    {team.tricode} <small>best PTS matchups</small>
                  </h3>
                  <ul>
                    {topEdges(featured.gameId, { tricode: team.tricode }).map((player) => (
                      <EdgeRow key={player.id} player={player} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {featuredTargets.length > 0 && (
              <div className="hp-d-targets">
                <span className="hp-kicker">Your Targets in this game</span>
                <div className="hp-d-target-row">
                  {featuredTargets.slice(0, 2).map((entry) => (
                    <TargetCard key={entry.target.id} entry={entry} density="compact" />
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="hp-d-rest-toggle" onClick={() => setOpen(!open)}>
              {rest.length} more games tonight
              {targets &&
                ` · ${targets.firing.length - featuredTargets.length} more Targets firing`}
              <ChevronDown size={14} className={open ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {open && (
              <div className="hp-d-rest">
                {rest.map((game) => (
                  <GameTile key={game.gameId} game={game} edge={bestEdgeInGame(game.gameId)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <Loading />
        )}
      </section>
      <div className="landing-container">{ladder}</div>
    </div>
  );
};

/* E: C's ticker on its own, no Targets. Each game shows its three biggest
   points Matchup effects, favourable or not. */
const VariantE = ({ hero, ladder, data, middle = null, heroSlot = null }) => {
  const { slate } = data;
  return (
    <div className="hp-c hp-e">
      <div className="hp-ticker" aria-label="Tonight's slate">
        <ProtoLink to="/matchups" className="hp-ticker-label">
          {slateDay}
          <b>{slate ? slate.games.length : '–'} games</b>
          <span className="hp-e-legend">PTS matchup</span>
        </ProtoLink>
        <div className="hp-ticker-track">
          {slate?.games.map((game) => (
            <ProtoLink
              key={game.gameId}
              to={`/matchups/${game.gameId}`}
              className="hp-tick hp-e-tick"
            >
              <span className="hp-tick-teams">{gameLabel(game)}</span>
              <span className="hp-tick-time">{tipoff(game.scheduledAt)}</span>
              <ul className="hp-e-effects">
                {biggestPtsEffects(game.gameId).map((player) => (
                  <li key={player.id}>
                    <span>
                      {lastName(player.name)} <small>{player.tricode}</small>
                    </span>
                    <EdgeValue value={player.value} />
                  </li>
                ))}
              </ul>
            </ProtoLink>
          ))}
        </div>
      </div>
      <div className="landing-container">
        {heroSlot || hero}
        {middle}
        {ladder}
      </div>
    </div>
  );
};

/* F/G/H: E's ticker plus a reason to stay. */
const VariantF = (props) => (
  <VariantE
    {...props}
    middle={<Spotlight slate={props.data.slate} onUseQuery={props.onUseQuery} />}
  />
);
const VariantG = (props) => (
  <VariantE {...props} ladder={<AnswerLadder onUseQuery={props.onUseQuery} />} />
);
const VariantH = (props) => (
  <VariantE
    {...props}
    middle={<Spotlight slate={props.data.slate} onUseQuery={props.onUseQuery} />}
    ladder={<AnswerLadder onUseQuery={props.onUseQuery} />}
  />
);

/* I/J: the headline stays dead centre; best matchup flanks it on the left,
   toughest on the right. I puts two Targets in a centred row under it; J
   stacks one Target under each matchup so the two sides mirror. */
const spotPicks = (slate) => {
  const gameOf = (pick) => slate?.games.find((game) => game.gameId === pick.gameId);
  const { best, worst } = hooks.spotlight;
  return { best, worst, bestGame: gameOf(best), worstGame: gameOf(worst) };
};

const TargetsHead = ({ targets }) => (
  <div className="hp-flank-targets-head">
    <span className="hp-kicker">Your Targets tonight</span>
    {targets && (
      <ProtoLink to="/targets" className="hp-more">
        {targets.firing.length} of {targets.total} firing →
      </ProtoLink>
    )}
  </div>
);

const VariantI = (props) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-flank">
          <div className="hp-flank-side hp-flank-left">
            <SpotlightCard
              kind="Best matchup tonight"
              pick={best}
              game={bestGame}
              onUseQuery={props.onUseQuery}
            />
          </div>
          <div className="hp-flank-center">{props.hero}</div>
          <div className="hp-flank-side hp-flank-right">
            <SpotlightCard
              kind="Toughest matchup tonight"
              pick={worst}
              game={worstGame}
              onUseQuery={props.onUseQuery}
            />
          </div>
        </div>
      }
      middle={
        <section className="hp-flank-targets" aria-label="Your Targets tonight">
          <TargetsHead targets={targets} />
          <div className="hp-flank-targets-row">
            {targets ? (
              targets.firing
                .slice(0, 2)
                .map((entry) => <TargetCard key={entry.target.id} entry={entry} withMatchup />)
            ) : (
              <Loading />
            )}
          </div>
        </section>
      }
      ladder={<AnswerLadder onUseQuery={props.onUseQuery} />}
    />
  );
};

const VariantJ = (props) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  const [left, right] = targets ? targets.firing : [];
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-flank hp-flank-j">
          <div className="hp-flank-side hp-flank-left">
            <SpotlightCard
              kind="Best matchup tonight"
              pick={best}
              game={bestGame}
              onUseQuery={props.onUseQuery}
            />
            {left && (
              <>
                <span className="hp-kicker hp-flank-kicker">Your Target firing</span>
                <TargetCard entry={left} withMatchup />
              </>
            )}
          </div>
          <div className="hp-flank-center">{props.hero}</div>
          <div className="hp-flank-side hp-flank-right">
            <SpotlightCard
              kind="Toughest matchup tonight"
              pick={worst}
              game={worstGame}
              onUseQuery={props.onUseQuery}
            />
            {right && (
              <>
                <span className="hp-kicker hp-flank-kicker">Your Target firing</span>
                <TargetCard entry={right} withMatchup />
              </>
            )}
          </div>
        </div>
      }
      ladder={<AnswerLadder onUseQuery={props.onUseQuery} />}
    />
  );
};

/* K: I with less on screen. L: K without Targets. */
const TargetLine = ({ entry }) => {
  const top = entry.players[0];
  return (
    <ProtoLink to={`/targets/${entry.target.id}`} className="hp-tline">
      <span className="hp-opp">vs {entry.target.opponent}</span>
      <span className="hp-tline-crit">
        {entry.target.qualifiers.map(qualifierText).join(' + ')}
      </span>
      <span className="hp-tline-fit">
        {shortName(top.name)}
        {entry.players.length > 1 && <small> +{entry.players.length - 1}</small>}
      </span>
    </ProtoLink>
  );
};

const Calm = ({ props, withTargets }) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-flank hp-calm">
          <div className="hp-flank-side hp-flank-left">
            <SlimSpot
              kind="Best matchup tonight"
              pick={best}
              game={bestGame}
              onUseQuery={props.onUseQuery}
            />
          </div>
          <div className="hp-flank-center">{props.hero}</div>
          <div className="hp-flank-side hp-flank-right">
            <SlimSpot
              kind="Toughest matchup tonight"
              pick={worst}
              game={worstGame}
              onUseQuery={props.onUseQuery}
            />
          </div>
        </div>
      }
      middle={
        withTargets && targets ? (
          <section className="hp-tlines" aria-label="Your Targets tonight">
            <div className="hp-tlines-head">
              <span className="hp-kicker">Your Targets firing tonight</span>
              <ProtoLink to="/targets" className="hp-more">
                All {targets.firing.length} →
              </ProtoLink>
            </div>
            {targets.firing.slice(0, 2).map((entry) => (
              <TargetLine key={entry.target.id} entry={entry} />
            ))}
          </section>
        ) : null
      }
      ladder={<AnswerLadder onUseQuery={props.onUseQuery} compact />}
    />
  );
};
/* M: the hero alone; matchups and Targets move below the ladder. */
const VariantM = (props) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  return (
    <VariantE
      {...props}
      ladder={
        <>
          <AnswerLadder onUseQuery={props.onUseQuery} compact referenceUp />
          <section className="hp-bottom" aria-label="Tonight">
            <div className="hp-bottom-pair">
              <div className="hp-flank-left">
                <SlimSpot
                  kind="Best matchup tonight"
                  pick={best}
                  game={bestGame}
                  onUseQuery={props.onUseQuery}
                />
              </div>
              <div className="hp-flank-right">
                <SlimSpot
                  kind="Toughest matchup tonight"
                  pick={worst}
                  game={worstGame}
                  onUseQuery={props.onUseQuery}
                />
              </div>
            </div>
            {targets && (
              <div className="hp-tlines hp-bottom-targets">
                <div className="hp-tlines-head">
                  <span className="hp-kicker">Your Targets firing tonight</span>
                  <ProtoLink to="/targets" className="hp-more">
                    All {targets.firing.length} →
                  </ProtoLink>
                </div>
                {targets.firing.slice(0, 2).map((entry) => (
                  <TargetLine key={entry.target.id} entry={entry} />
                ))}
              </div>
            )}
          </section>
        </>
      }
    />
  );
};

/* N–Q: the same content as M, arranged four ways. */
const useTonight = (props) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  const bestCard = (
    <SlimSpot
      kind="Best matchup tonight"
      pick={best}
      game={bestGame}
      onUseQuery={props.onUseQuery}
    />
  );
  const worstCard = (
    <SlimSpot
      kind="Toughest matchup tonight"
      pick={worst}
      game={worstGame}
      onUseQuery={props.onUseQuery}
    />
  );
  const targetList = targets ? (
    <div className="hp-tlines">
      <div className="hp-tlines-head">
        <span className="hp-kicker">Your Targets firing tonight</span>
        <ProtoLink to="/targets" className="hp-more">
          All {targets.firing.length} →
        </ProtoLink>
      </div>
      {targets.firing.slice(0, 2).map((entry) => (
        <TargetLine key={entry.target.id} entry={entry} />
      ))}
    </div>
  ) : null;
  return { bestCard, worstCard, targetList, targets };
};

const VariantN = (props) => {
  const [tab, setTab] = useState('tonight');
  const { bestCard, worstCard, targetList } = useTonight(props);
  return (
    <VariantE
      {...props}
      ladder={
        <section className="hp-tabs" aria-label="Tonight and examples">
          <div className="hp-tabs-bar" role="tablist">
            {[
              ['tonight', 'Tonight'],
              ['ask', 'Try a question'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'is-on' : ''}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'tonight' ? (
            <div className="hp-tabs-panel">
              <div className="hp-bottom-pair">
                <div className="hp-flank-left">{bestCard}</div>
                <div className="hp-flank-right">{worstCard}</div>
              </div>
              <div className="hp-bottom-targets">{targetList}</div>
            </div>
          ) : (
            <div className="hp-tabs-panel">
              <AnswerLadder onUseQuery={props.onUseQuery} compact referenceUp />
            </div>
          )}
        </section>
      }
    />
  );
};

const VariantO = (props) => {
  const oneLine = props.variant === 'Y' || props.variant === 'Z';
  // Z: Targets get a third column of their own.
  const three = props.variant === 'Z';
  const { bestCard, worstCard, targetList } = useTonight(props);
  const { targets } = props.data;
  return (
    <VariantE
      {...props}
      heroSlot={<div className={`hp-o-hero${oneLine ? ' hp-one-line' : ''}`}>{props.hero}</div>}
      ladder={
        <section className={`hp-cols${three ? ' hp-cols3' : ''}`}>
          <div className="hp-col">
            <div className="hp-col-head">
              <h2 className="hp-section-title">Try a question</h2>
              <ProtoLink to="/help" className="hp-more">
                Every filter →
              </ProtoLink>
            </div>
            <LadderRows onUseQuery={props.onUseQuery} />
          </div>
          <div className="hp-col">
            <div className="hp-col-head">
              <h2 className="hp-section-title">Tonight</h2>
              <ProtoLink to="/matchups" className="hp-more">
                Matchups →
              </ProtoLink>
            </div>
            <div className="hp-col-stack">
              {bestCard}
              {worstCard}
              {!three && targetList}
            </div>
          </div>
          {three && (
            <div className="hp-col">
              <div className="hp-col-head">
                <h2 className="hp-section-title">Your Targets</h2>
                <ProtoLink to="/targets" className="hp-more">
                  {targets ? `${targets.firing.length} firing →` : 'All →'}
                </ProtoLink>
              </div>
              <div className="hp-col-stack hp-col-targets">
                {targets?.firing.slice(0, 3).map((entry) => (
                  <TargetCard key={entry.target.id} entry={entry} density="compact" withMatchup />
                ))}
              </div>
            </div>
          )}
        </section>
      }
    />
  );
};

/* Z2: Z, calmer: the questions as one row, Tonight and Targets side by side. */
const VariantZ2 = (props) => {
  // Z3: the same, with the per-step bar charts kept in the questions row.
  const withBars = props.variant === 'Z3';
  const { bestCard, worstCard } = useTonight(props);
  const { targets } = props.data;
  return (
    <VariantE
      {...props}
      heroSlot={<div className="hp-o-hero hp-one-line">{props.hero}</div>}
      ladder={
        <div className="hp-z2">
          {withBars ? (
            <AnswerLadder onUseQuery={props.onUseQuery} compact referenceUp />
          ) : (
            <LadderPath onUseQuery={props.onUseQuery} />
          )}
          <section className="hp-cols hp-z2-cols">
            <div className="hp-col">
              <div className="hp-col-head">
                <h2 className="hp-section-title">Tonight</h2>
                <ProtoLink to="/matchups" className="hp-more">
                  Matchups →
                </ProtoLink>
              </div>
              <div className="hp-col-stack">
                {bestCard}
                {worstCard}
              </div>
            </div>
            <div className="hp-col">
              <div className="hp-col-head">
                <h2 className="hp-section-title">Your Targets</h2>
                <ProtoLink to="/targets" className="hp-more">
                  {targets ? `All ${targets.firing.length} firing →` : 'All →'}
                </ProtoLink>
              </div>
              <div className="hp-z2-targets">
                {targets?.firing.slice(0, 4).map((entry) => (
                  <TargetLine key={entry.target.id} entry={entry} />
                ))}
              </div>
            </div>
          </section>
        </div>
      }
    />
  );
};

const VariantP = (props) => {
  const { slate } = props.data;
  const { best, worst } = spotPicks(slate);
  const { targets } = props.data;
  const band = (
    <div className="hp-band" aria-label="Tonight at a glance">
      <button
        type="button"
        className="hp-band-item is-up"
        onClick={() => props.onUseQuery(`${best.name} this year against bottom 10 defenses`)}
      >
        <span className="hp-band-k">Best</span>
        <b>{best.name}</b>
        <span className="hp-edge is-up">{pct(best.value, 1)}</span>
        <small>vs {best.opponent}</small>
      </button>
      <ProtoLink to="/targets" className="hp-band-item hp-band-targets">
        <span className="hp-band-k">Your Targets</span>
        <b>{targets ? `${targets.firing.length} firing` : '…'}</b>
        {targets && (
          <small>
            {targets.firing
              .slice(0, 2)
              .map((entry) => `vs ${entry.target.opponent}`)
              .join(' · ')}
          </small>
        )}
      </ProtoLink>
      <button
        type="button"
        className="hp-band-item is-down"
        onClick={() => props.onUseQuery(`${worst.name} this year against top 10 defenses`)}
      >
        <span className="hp-band-k">Toughest</span>
        <b>{worst.name}</b>
        <span className="hp-edge is-down">{pct(worst.value, 1)}</span>
        <small>vs {worst.opponent}</small>
      </button>
    </div>
  );
  return (
    <VariantE
      {...props}
      heroSlot={
        <>
          {band}
          {props.hero}
        </>
      }
      ladder={<AnswerLadder onUseQuery={props.onUseQuery} compact referenceUp />}
    />
  );
};

/* R: saved Filter Sets left of the headline, Tonight right of it.
   S: a page-length left sidebar for what is yours (saved sets, Targets);
   discovery stays in the main column. */
const VariantR = (props) => {
  const { bestCard, worstCard, targetList } = useTonight(props);
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-flank hp-calm hp-has-saved">
          <div className="hp-flank-side hp-flank-left">
            <SavedRail />
          </div>
          <div className="hp-flank-center">{props.hero}</div>
          <div className="hp-flank-side hp-flank-right hp-r-tonight">
            {bestCard}
            {worstCard}
          </div>
        </div>
      }
      middle={<LadderPath onUseQuery={props.onUseQuery} />}
      ladder={<div className="hp-r-targets">{targetList}</div>}
    />
  );
};

const VariantS = (props) => {
  const { bestCard, worstCard, targetList } = useTonight(props);
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-s hp-has-saved">
          <aside className="hp-s-side" aria-label="Yours">
            <SavedRail limit={6} />
            {targetList}
          </aside>
          <div className="hp-s-main">
            {props.hero}
            <LadderPath onUseQuery={props.onUseQuery} />
            <section className="hp-bottom-pair hp-s-pair" aria-label="Tonight">
              <div className="hp-flank-left">{bestCard}</div>
              <div className="hp-flank-right">{worstCard}</div>
            </section>
          </div>
        </div>
      }
      ladder={null}
    />
  );
};

const VariantQ = (props) => {
  const { bestCard, worstCard, targetList } = useTonight(props);
  return (
    <VariantE
      {...props}
      middle={<LadderPath onUseQuery={props.onUseQuery} />}
      ladder={
        <section className="hp-tri" aria-label="Tonight">
          <div className="hp-flank-left">{bestCard}</div>
          <div className="hp-tri-center">{targetList}</div>
          <div className="hp-flank-right">{worstCard}</div>
        </section>
      }
    />
  );
};

const VariantK = (props) => <Calm props={props} withTargets />;
const VariantL = (props) => <Calm props={props} withTargets={false} />;

const VARIANTS = {
  Z3: VariantZ2,
  Z2: VariantZ2,
  Z: VariantO,
  Y: VariantO,
  W: VariantW,
  X: VariantX,
  T: VariantT,
  U: VariantU,
  V: VariantV,
  R: VariantR,
  S: VariantS,
  N: VariantN,
  O: VariantO,
  P: VariantP,
  Q: VariantQ,
  M: VariantM,
  K: VariantK,
  L: VariantL,
  I: VariantI,
  J: VariantJ,
  H: VariantH,
  F: VariantF,
  G: VariantG,
  E: VariantE,
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: VariantD,
};

const HomePreviewPrototype = ({ hero, ladder, variant, step, onUseQuery }) => {
  const data = useHomePreviewData();
  const Variant = VARIANTS[variant];
  return (
    <>
      <div className="landing-page hp-page">
        {Variant ? (
          <Variant
            hero={hero}
            ladder={ladder}
            data={data}
            onUseQuery={onUseQuery}
            variant={variant}
          />
        ) : (
          <div className="landing-container">
            {hero}
            {ladder}
          </div>
        )}
        {data.error && <p className="hp-loading">Prototype data failed: {data.error}</p>}
      </div>
      <PrototypeSwitcher variant={variant} onStep={step} />
    </>
  );
};

export default HomePreviewPrototype;
