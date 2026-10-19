import { Link } from 'react-router-dom';
import LegalPage, { SupportEmail } from './LegalPage';

const TermsPage = () => (
  <LegalPage title="Terms of Service">
    <p>
      These terms cover your use of courtai.app and the CourtAI connector at mcp.courtai.app
      (together, &ldquo;CourtAI&rdquo;), run by CourtAI (&ldquo;we&rdquo;). By using CourtAI you
      agree to them. If you do not agree, do not use CourtAI.
    </p>

    <h2>Who can use CourtAI</h2>
    <p>
      You must be at least 18 years old. You sign in with a Google account and are responsible for
      what happens under it. We may limit sign-ups, place accounts on a waitlist, or suspend an
      account that breaks these terms.
    </p>

    <h2>Information, not betting advice</h2>
    <p>
      CourtAI is a research tool. It reports NBA statistics, matchups and lines published by third
      parties; it does not predict outcomes, recommend wagers, or accept bets. Nothing on CourtAI is
      betting, financial or professional advice, and past results do not guarantee future ones. You
      are solely responsible for any decision you make and for following the laws where you live. If
      gambling is a problem for you or someone you know, call 1-800-GAMBLER (in the US).
    </p>

    <h2>Data accuracy</h2>
    <p>
      Statistics, injury reports and lines come from third-party sources and may be delayed,
      incomplete or wrong. We do not guarantee their accuracy, completeness or availability.
    </p>

    <h2>Acceptable use</h2>
    <p>Do not:</p>
    <ul>
      <li>scrape, bulk-download or resell CourtAI data, or work around rate limits;</li>
      <li>
        interfere with, probe or overload the service, or access other people&rsquo;s accounts;
      </li>
      <li>reverse-engineer CourtAI except where the law allows it;</li>
      <li>use CourtAI for anything unlawful.</li>
    </ul>

    <h2>Connected AI apps</h2>
    <p>
      When you connect an AI app such as Claude or ChatGPT, it reads your CourtAI data on your
      behalf, and that app&rsquo;s own terms apply to it. AI apps can misread or misstate what
      CourtAI returns, so check anything that matters against CourtAI itself.
    </p>

    <h2>Your content</h2>
    <p>
      Targets, notes and filter sets you create remain yours. You let us store and process them to
      run CourtAI for you.
    </p>

    <h2>Changes and availability</h2>
    <p>
      CourtAI is in beta. We may change, suspend or discontinue any part of it, and we may update
      these terms by posting a new version here with a new effective date. Continuing to use CourtAI
      after an update means you accept it.
    </p>

    <h2>Disclaimers and liability</h2>
    <p>
      CourtAI is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of
      any kind. To the fullest extent the law allows, we are not liable for any indirect, incidental
      or consequential damages, or for any losses, including betting losses, arising from your use
      of CourtAI or reliance on its data.
    </p>

    <h2>Ending your use</h2>
    <p>
      You can stop using CourtAI at any time and ask us to delete your account at <SupportEmail />.
      We may suspend or end your access if you break these terms.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about these terms go to <SupportEmail />. How we handle your data is described in
      our <Link to="/privacy">Privacy Policy</Link>.
    </p>
  </LegalPage>
);

export default TermsPage;
