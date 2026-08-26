"use client";

const S = {
  page: { minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" },
  header: { borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 },
  headerInner: { maxWidth: 720, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoMark: { width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 },
  logoText: { fontWeight: 600, fontSize: 15, color: "#1a1a1a" },
  back: { fontSize: 13, color: "#888", textDecoration: "none" },
  body: { maxWidth: 720, margin: "0 auto", padding: "40px 20px 96px" },
  banner: { background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#92600A", lineHeight: 1.6, marginBottom: 32 },
  h1: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.4px", margin: "0 0 6px" },
  updated: { fontSize: 13, color: "#aaa", marginBottom: 36 },
  h2: { fontSize: 17, fontWeight: 600, margin: "36px 0 12px" },
  p: { fontSize: 14, color: "#444", lineHeight: 1.75, margin: "0 0 14px" },
  ul: { fontSize: 14, color: "#444", lineHeight: 1.75, margin: "0 0 14px", paddingLeft: 20 },
  placeholder: { background: "#FEF3C7", padding: "0 4px", borderRadius: 3 },
};

function Shell({ children }) {
  return (
    <div style={S.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; }`}</style>
      <header style={S.header}>
        <div style={S.headerInner}>
          <a href="/" style={S.logo}>
            <div style={S.logoMark}>C</div>
            <span style={S.logoText}>Cruiser</span>
          </a>
          <a href="/" style={S.back}>Back to home</a>
        </div>
      </header>
      <div style={S.body}>{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <Shell>
      <div style={S.banner}>
        <strong>Draft document.</strong> This is a starting-point Terms of Service written for launch, not a substitute for review by a qualified attorney. Have it reviewed before relying on it to limit liability or resolve a real dispute.
      </div>

      <h1 style={S.h1}>Terms of Service</h1>
      <div style={S.updated}>Last updated: August 25, 2026</div>

      <h2 style={S.h2}>1. What Cruiser is</h2>
      <p style={S.p}>
        Cruiser is a listings and community platform for car meets, cruises, and related events ("Meets"). Cruiser helps people discover and post about Meets, and provides profile, garage, and discussion features for the car enthusiast community.
      </p>
      <p style={S.p}>
        <strong>Cruiser does not organize, host, sponsor, verify, or guarantee any Meet.</strong> Meets are submitted by users and reviewed for basic completeness before being listed, but Cruiser does not confirm that a Meet will actually occur, that the listed details are accurate, or that the location is safe, permitted, or authorized. Attending, hosting, or interacting with anyone through a Meet listed on Cruiser is entirely at your own risk and discretion.
      </p>

      <h2 style={S.h2}>2. Accounts</h2>
      <p style={S.p}>
        You need an account to submit Meets, comment, post, or build a profile. You're responsible for the activity on your account and for keeping your login credentials secure. You must provide an accurate email address, and you're responsible for anything posted from your account.
      </p>
      <p style={S.p}>
        You must be at least <span style={S.placeholder}>13 years old</span> to use Cruiser. <span style={S.placeholder}>[Confirm the minimum age requirement and add any parental-consent language your legal reviewer recommends.]</span>
      </p>

      <h2 style={S.h2}>3. Your content</h2>
      <p style={S.p}>
        You retain ownership of the comments, posts, photos, vehicle information, and other content you submit ("User Content"). By posting User Content, you grant Cruiser a worldwide, non-exclusive, royalty-free license to host, display, and distribute it as part of operating the service.
      </p>
      <p style={S.p}>You agree not to post User Content that:</p>
      <ul style={S.ul}>
        <li>Is illegal, harassing, threatening, or hateful</li>
        <li>Infringes someone else's intellectual property or privacy</li>
        <li>Is spam, misleading, or fraudulent</li>
        <li>Depicts dangerous, reckless, or illegal driving as encouragement rather than incidental content</li>
        <li>You don't have the right to post</li>
      </ul>
      <p style={S.p}>
        Comments, posts, and vehicle photos can be reported by other users and removed by moderators at our discretion. Repeated or severe violations may result in content removal, suspension, or termination of your account.
      </p>

      <h2 style={S.h2}>4. Meet submissions</h2>
      <p style={S.p}>
        Submitted Meets are reviewed before appearing publicly, but review is a basic check, not a guarantee of accuracy, legality, or safety. Hosts are solely responsible for the events they list, including obtaining any permits, permissions, or insurance required. Cruiser may reject, edit, or remove a listing at any time.
      </p>

      <h2 style={S.h2}>5. Disclaimers</h2>
      <p style={S.p}>
        Cruiser is provided "as is" without warranties of any kind. We don't guarantee the service will be uninterrupted, error-free, or secure. We are not responsible for the conduct of any user, host, or attendee, on or off the platform, or for anything that happens at a Meet listed on Cruiser.
      </p>
      <p style={S.p}>
        To the fullest extent permitted by law, Cruiser and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the service or attendance at any Meet. <span style={S.placeholder}>[A legal reviewer should tailor this limitation-of-liability language to your jurisdiction.]</span>
      </p>

      <h2 style={S.h2}>6. Termination</h2>
      <p style={S.p}>
        You can stop using Cruiser and delete your account at any time. We may suspend or terminate accounts that violate these terms, including for repeated content violations.
      </p>

      <h2 style={S.h2}>7. Changes to these terms</h2>
      <p style={S.p}>
        We may update these terms as Cruiser evolves. Material changes will be reflected by updating the "Last updated" date above. Continuing to use Cruiser after changes take effect means you accept the updated terms.
      </p>

      <h2 style={S.h2}>8. Contact</h2>
      <p style={S.p}>
        Questions about these terms can be sent to <span style={S.placeholder}>[insert contact email]</span>.
      </p>
    </Shell>
  );
}
