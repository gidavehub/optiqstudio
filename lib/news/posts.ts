import type { Post } from "./types";
import { VIDEOS } from "./videos";

// The Optiq Studio blog.
//
// Video slots spread an entry from ./videos, which carries both the YouTube ID
// and its published title. While a cut is still an unlisted draft the player
// falls back to a reserved card, and starts working when it goes public.

const DAVE = "Godswill Iyke Dave";
const TEAM = "The Optiq Studio Team";

export const POSTS: Post[] = [
  {
    slug: "introducing-optiq-studio",
    title: "Introducing Optiq Studio: a studio-quality video ad for less than $5",
    cardTitle: "Introducing Optiq Studio",
    category: "Product",
    published: "2026-07-30T17:00:00+00:00",
    excerpt:
      "Describe your business, describe the video, press generate. Optiq Studio makes a studio-quality commercial in three steps for less than five dollars — live now.",
    authors: [DAVE],
    hero: "optiq-horizon",
    featured: true,
    keywords: [
      "Optiq Studio",
      "AI video ad generator",
      "AI commercial generator",
      "cheap video ads",
      "text to video ads",
      "small business video marketing",
      "video ads West Africa",
    ],
    body: [
      {
        t: "lede",
        text: "In countries like America, small businesses get most of their customers online using video ads. Here in The Gambia and across West Africa, almost no small business can do that. It is not because our business owners lack good products or vision.",
      },
      {
        t: "p",
        text: "It is because a studio-quality video ad costs thousands of dollars. For a local bakery, a tailor, a mechanic or a new business, that price is out of reach — so they are locked out of a digital market their customers are already sitting in every day.",
      },
      { t: "p", text: "**Optiq Studio is live now**, and it puts that number below five dollars." },
      { t: "image", asset: "optiq-horizon", full: true, caption: "Optiq Studio launched at DaveLabs Horizon Summer '26." },

      { t: "h2", text: "Three steps" },
      {
        t: "list",
        ordered: true,
        items: [
          "**Describe your business or product.** Plain language. No brief, no agency template, no discovery call.",
          "**Describe the video you want** — or choose a template — then set your length.",
          "**Press generate.**",
        ],
      },
      {
        t: "p",
        text: "In the background, a multi-agent system takes over: storyboarding, cinematography, script reasoning, soundscape balancing and scene compilation, matched to the aesthetic of your brand. We wrote about [how the agents divide the work](/blog/inside-the-multi-agent-system).",
      },
      { t: "youtube", ...VIDEOS.optiqTrailer },

      { t: "h2", text: "What comes out" },
      {
        t: "list",
        items: [
          "A finished commercial with voice, music and sound design.",
          "Cut for the aspect ratio you need — vertical for social, wide for everything else.",
          "Consistent characters, sets and camera across every scene, not a slideshow of unrelated shots.",
        ],
      },
      {
        t: "stats",
        items: [
          { value: "< $5", label: "Per studio-quality commercial" },
          { value: "3", label: "Steps from idea to finished ad" },
          { value: "4K", label: "Finished output resolution" },
        ],
      },
      {
        t: "quote",
        text: "Today, we give the power of storytelling back to every entrepreneur, every creator, and every business owner across our continent.",
        cite: `${DAVE}, Keynote 2, DaveLabs Horizon Summer '26`,
      },
      {
        t: "callout",
        title: "Want it done for you?",
        body: "Optiq Studio Enterprise puts our creative team on your commercial — custom production from $100 per ad, or a full performance campaign cycle.",
        cta: { label: "Read about Enterprise", href: "/blog/optiq-studio-enterprise" },
      },
    ],
  },

  {
    slug: "the-five-dollar-commercial",
    title: "What a commercial actually costs — and what we removed to get under $5",
    cardTitle: "The $5 commercial",
    category: "Company",
    published: "2026-07-30T16:50:00+00:00",
    excerpt:
      "A broadcast commercial costs $3,000 to $20,000 and needs a crew, a rig, actors and an editor. Here is what Optiq Studio takes out of that bill, and what it deliberately keeps.",
    authors: [TEAM],
    hero: "optiq-horizon",
    keywords: [
      "cost of a video ad",
      "video production cost",
      "affordable video advertising",
      "Optiq Studio pricing",
      "small business advertising Africa",
    ],
    body: [
      {
        t: "lede",
        text: "Producing a traditional broadcast-grade commercial costs between $3,000 and $20,000. That figure is not padding. It is camera crews, lighting rigs, actors, a sound engineer, a location, and an editor who bills by the day.",
      },
      {
        t: "stats",
        items: [
          { value: "$3k–$20k", label: "Typical cost of a traditional broadcast commercial" },
          { value: "< $5", label: "Cost of a studio-quality commercial in Optiq Studio" },
          { value: "Minutes", label: "Instead of the weeks a shoot takes to schedule" },
        ],
      },

      { t: "h2", text: "Six decisions and a lot of logistics" },
      {
        t: "p",
        text: "Strip a commercial down and you are paying for six things: how the story is paced, how the set looks, who is in it, how it sounds, how the camera moves, and how it is cut together. Everything else on the invoice is the cost of getting human beings into a room to make those six decisions.",
      },
      {
        t: "p",
        text: "Optiq Studio removes the logistics and keeps the decisions. Five specialist agents each own one of them, which is [why the output holds together](/blog/inside-the-multi-agent-system) instead of looking like a prompt-generated slideshow.",
      },

      { t: "h2", text: "What we did not remove" },
      {
        t: "list",
        items: [
          "**Sound design.** It is the fastest way to tell a cheap ad from a good one, so it gets its own agent.",
          "**Character consistency.** A face that changes between shots reads as fake instantly.",
          "**Camera discipline.** Real optical behaviour, not arbitrary drift.",
        ],
      },
      { t: "image", asset: "dave-keynote", full: true, caption: "Keynote 2 at DaveLabs Horizon Summer '26." },

      { t: "h2", text: "Who this changes things for" },
      {
        t: "p",
        text: "A bakery that can finally show the bread coming out of the oven instead of describing it. A tailor whose work photographs badly but films beautifully. A mechanic whose entire competitive advantage is trust, which is very hard to convey in a static post.",
      },
      {
        t: "callout",
        title: "Make your first ad",
        body: "Describe your business, choose a length, press generate.",
        cta: { label: "Open the studio", href: "/dashboard/create" },
      },
    ],
  },

  {
    slug: "inside-the-multi-agent-system",
    title: "Five agents, one commercial: inside the Optiq Studio multi-agent system",
    cardTitle: "Inside the multi-agent system",
    category: "Research",
    published: "2026-07-30T16:40:00+00:00",
    excerpt:
      "A director, a stage builder, a character designer, a soundscape mixer and a cinematographer. Why we split ad generation across five specialists instead of asking one model to do everything.",
    authors: [DAVE],
    hero: "optiq-horizon",
    keywords: [
      "multi-agent AI",
      "AI video generation architecture",
      "Optiq Studio agents",
      "AI cinematography",
      "agentic AI",
      "AI storyboard generation",
    ],
    body: [
      {
        t: "lede",
        text: "Ask a single model to write, cast, light, score and shoot a commercial and it will do all five adequately and none of them well. The failure mode is always the same: every shot looks like it came from a different film.",
      },
      { t: "p", text: "Optiq Studio splits the job across five agents, each owning one decision and each constrained by the others' output." },

      { t: "h2", text: "The five" },
      { t: "h3", text: "Director" },
      { t: "p", text: "Paces the narrative and owns the campaign message. Decides what happens in which second, and what the viewer should feel by the end. Everything downstream inherits this structure." },
      { t: "h3", text: "Stage Builder" },
      { t: "p", text: "Designs the sets, lighting palettes and colour blocking. Because one agent owns this across every scene, the third shot lives in the same world as the first." },
      { t: "h3", text: "Character Designer" },
      { t: "p", text: "Casting, facial consistency and wardrobe. This is the agent that stops the person in shot two from being a different person in shot four — the single most obvious tell in AI-generated video." },
      { t: "h3", text: "Soundscape Mixer" },
      { t: "p", text: "Balances music tempo, effects, ambience and voiceover tone against the Director's pacing." },
      { t: "h3", text: "Cinematographer" },
      { t: "p", text: "Camera motion, depth of field and transitions — 35mm optical behaviour rather than arbitrary drift." },

      { t: "youtube", ...VIDEOS.optiqTrailer },

      { t: "h2", text: "Why the split works" },
      {
        t: "p",
        text: "Consistency is a constraint-satisfaction problem, not a prompting problem. Once character, set and camera are each owned by a component that persists across the whole timeline, the output stops drifting — because no single scene is free to reinvent them.",
      },
      {
        t: "stats",
        items: [
          { value: "5", label: "Specialist agents per generation" },
          { value: "1", label: "Prompt from the business owner" },
          { value: "4K", label: "Finished output resolution" },
        ],
      },
      {
        t: "callout",
        title: "See it run",
        body: "The whole pipeline sits behind one text box.",
        cta: { label: "Open the studio", href: "/dashboard/create" },
      },
    ],
  },

  {
    slug: "three-steps-to-your-first-ad",
    title: "Three steps to your first ad: a walkthrough",
    cardTitle: "Three steps to your first ad",
    category: "Product",
    published: "2026-07-30T16:30:00+00:00",
    excerpt:
      "What to write in the prompt, how to pick a length, and the three things that make the difference between a decent first ad and a good one.",
    authors: [TEAM],
    hero: "optiq-horizon",
    keywords: [
      "how to make a video ad",
      "AI ad tutorial",
      "Optiq Studio guide",
      "video ad prompt",
      "AI video prompt tips",
    ],
    body: [
      {
        t: "lede",
        text: "You do not need to know anything about film to get a good ad out of Optiq Studio. You do need to be specific about your business — which is the one thing you already know better than anyone.",
      },

      { t: "h2", text: "Step 1 — Describe your business or product" },
      {
        t: "p",
        text: "Write it the way you would explain it to a customer standing in front of you. What you sell, who buys it, and what makes someone choose you over the shop down the road.",
      },
      {
        t: "list",
        items: [
          "**Too vague:** *A bakery.*",
          "**Better:** *A family bakery in Serekunda. We bake tapalapa and sourdough fresh from 5am. Our customers are office workers buying breakfast on the way in.*",
        ],
      },
      { t: "p", text: "The second version already tells the Director the time of day, the mood and the buyer. That is most of the job." },

      { t: "h2", text: "Step 2 — Describe the video, or pick a template" },
      {
        t: "p",
        text: "Say what kind of ad you want — energetic, warm, premium, funny — and set the length. Short is usually right: a first ad for social does more work at 10 to 15 seconds than at 60.",
      },
      { t: "youtube", ...VIDEOS.optiqTrailer },

      { t: "h2", text: "Step 3 — Generate" },
      { t: "p", text: "Five agents handle storyboarding, casting, sound, camera and cut. You get a finished commercial with voice and music, ready to post." },

      { t: "h2", text: "Three things that improve every ad" },
      {
        t: "list",
        ordered: true,
        items: [
          "**Name the objection.** The thing customers hesitate about is the thing your ad should answer on screen.",
          "**Pick one message.** An ad that says three things says none of them.",
          "**Show the product doing its job**, not sitting still.",
        ],
      },
      {
        t: "callout",
        title: "Start now",
        body: "Your first ad takes about as long to describe as it does to read this page.",
        cta: { label: "Open the studio", href: "/dashboard/create" },
      },
    ],
  },

  {
    slug: "optiq-studio-enterprise",
    title: "Optiq Studio Enterprise: two tiers, one outcome",
    cardTitle: "Introducing Optiq Studio Enterprise",
    category: "Enterprise",
    published: "2026-07-30T16:20:00+00:00",
    excerpt:
      "Custom Video Production puts our creative team on your commercial from $100 per ad. The Enterprise Campaign Engine takes five organisations per cycle and is paid on results.",
    authors: [DAVE],
    hero: "optiq-horizon",
    cardImage: "dave-keynote",
    keywords: [
      "Optiq Studio Enterprise",
      "custom video production",
      "enterprise video ads",
      "performance marketing",
      "brand campaign engine",
    ],
    body: [
      {
        t: "lede",
        text: "Optiq Studio puts a whole production studio in your hands. Optiq Studio Enterprise puts our team behind the camera for you.",
      },
      {
        t: "p",
        text: "Announced in Keynote 3 of DaveLabs Horizon Summer '26, Enterprise runs on two tiers — one for brands that want a finished commercial made for them, and one for organisations that want a growth outcome rather than a video file.",
      },

      { t: "h2", text: "Tier one — Custom Video Production" },
      {
        t: "p",
        text: "A flat fee of **$100 to $200 per video ad** (D6,500 to D13,000). Our in-house creative team works directly with your business: scriptwriting, storyboarding, directing, custom sound design and colour-graded 4K finishing.",
      },
      {
        t: "list",
        items: [
          "A working session to understand your business, audience and the story this campaign has to tell.",
          "Written, storyboarded and directed by our team — our prompt-craft, our platform, and years of hands-on production.",
          "Sound, music, pacing and colour finished in professional tools, reviewed with you until it is right.",
          "A cinematic ad ready for every screen.",
        ],
      },

      { t: "h2", text: "Tier two — the Enterprise Campaign Engine" },
      {
        t: "p",
        text: "This is not a video generator. It is an outcome-driven growth engine, and we limit it to **five organisations per campaign cycle**.",
      },
      {
        t: "p",
        text: "The defining term: we do not get paid until we deliver results. Success is measured on return on investment, sales and customer lifetime value — [not on deliverables](/blog/enterprise-campaign-engine).",
      },
      {
        t: "stats",
        items: [
          { value: "$100–$200", label: "Per custom-produced video ad" },
          { value: "5", label: "Organisations accepted per campaign cycle" },
          { value: "329+", label: "Industries mapped in our demographic models" },
        ],
      },
      { t: "image", asset: "dave-keynote", full: true, caption: "Keynote 3 at DaveLabs Horizon Summer '26." },
      { t: "youtube", ...VIDEOS.enterpriseKeynote },
      {
        t: "callout",
        title: "Apply for a campaign cycle",
        body: "Five places per cycle. Tell us your brand, your market and the outcome you need.",
        cta: { label: "See Enterprise", href: "/enterprise" },
      },
    ],
  },

  {
    slug: "enterprise-campaign-engine",
    title: "We don't get paid until your campaign works",
    cardTitle: "We don't get paid until it works",
    category: "Enterprise",
    published: "2026-07-30T16:10:00+00:00",
    excerpt:
      "The Enterprise Campaign Engine is paid on outcomes, not deliverables. Why we capped it at five organisations per cycle, and what we measure instead of impressions.",
    authors: [DAVE],
    hero: "dave-keynote",
    cardImage: "optiq-horizon",
    keywords: [
      "performance based marketing",
      "pay on results agency",
      "ROI marketing",
      "campaign attribution",
      "outcome based pricing",
    ],
    body: [
      {
        t: "lede",
        text: "Most marketing contracts are paid on delivery. You get the videos, the posts and the report, and whether any of it moved the business is treated as a separate conversation. The Enterprise Campaign Engine inverts that.",
      },
      {
        t: "quote",
        text: "Because we operate on true accountability. In this tier, we do not get paid until we deliver real results for your business.",
        cite: `${DAVE}, Keynote 3, DaveLabs Horizon Summer '26`,
      },

      { t: "h2", text: "What we measure" },
      {
        t: "list",
        items: [
          "**Return on investment** — against the spend, not against a vanity baseline.",
          "**Sales** — closed revenue attributable to the campaign.",
          "**Customer lifetime value** — because a campaign that buys one-time buyers is a campaign that failed slowly.",
        ],
      },
      { t: "p", text: "Impressions, reach and engagement are diagnostics. They tell us whether the creative is landing. They are not what the contract settles on." },

      { t: "h2", text: "Why only five organisations per cycle" },
      {
        t: "p",
        text: "Because the model only works with real attention. A performance guarantee spread across thirty clients is a portfolio bet, not accountability — some work, some do not, and the average pays the bill. Five means every campaign has to work on its own.",
      },

      { t: "h2", text: "The Intelligence Dashboard" },
      { t: "p", text: "Every cycle ships with a dashboard built for the campaign:" },
      {
        t: "list",
        items: [
          "**Source and platform attribution** — every lead and sale traced to the exact video, platform, placement and audience that produced it.",
          "**Audience intelligence** — who is actually converting, so the next wave points at the people already saying yes.",
          "**AI lead scoring** — every interaction scored for intent, ranking your warm audience.",
          "**Retargeting engine** — the people who watched, clicked and nearly bought, re-approached with the creative most likely to close them.",
          "**Creative performance** — a live leaderboard of which hooks earn the cheapest results, so budget moves to the winners mid-cycle.",
          "**Privacy-first by design** — aggregated and anonymised. Cohorts and signals, never personal records.",
        ],
      },

      { t: "h2", text: "How a cycle runs" },
      {
        t: "agenda",
        items: [
          { at: "Wk 0", label: "Kickoff and creative lock — story, format mix, budget, tracking live before a dalasi is spent" },
          { at: "Wk 1–4", label: "Production wave — scripts, renders, shoots, edits, publishing begins on approval" },
          { at: "Wk 4–10", label: "Publish, read, reallocate — budget shifts to winning creative, warm audience retargeted" },
          { at: "Wk 11–12", label: "Report and renew — full read against the model, and the plan for the next wave" },
        ],
      },
      {
        t: "callout",
        title: "Five places per cycle",
        body: "If you want a growth outcome rather than a video file, start the conversation.",
        cta: { label: "See Enterprise", href: "/enterprise" },
      },
    ],
  },

  {
    slug: "329-industries",
    title: "329 industries, mapped",
    category: "Research",
    published: "2026-07-30T16:00:00+00:00",
    excerpt:
      "A hotel does not sell like a bakery, and a bakery in Serekunda does not sell like a bakery in Lagos. What we learned mapping 329 West African and global industries.",
    authors: [TEAM],
    hero: "optiq-horizon",
    keywords: [
      "industry data West Africa",
      "customer demographics Africa",
      "marketing research",
      "329 industries",
      "audience modelling",
    ],
    body: [
      {
        t: "lede",
        text: "Whether you run a fashion boutique, a hotel, a real estate firm or a bakery, we know who your customers are and what type of videos make them buy. That claim only holds if somebody did the work of finding out.",
      },
      {
        t: "p",
        text: "Our models are trained on demographic and behavioural data across **329+ mapped industries** in The Gambia, West Africa and comparable global markets.",
      },

      { t: "h2", text: "The categories" },
      {
        t: "list",
        items: [
          "**Food & Drink** — restaurants, cafés, bakeries, juice bars, catering, food producers, food trucks.",
          "**Retail & Fashion** — boutiques, menswear, womenswear, children's wear, footwear, tailoring, fabrics, jewellery, thrift.",
          "**Beauty & Personal Care** — salons, barbershops, spas, cosmetics, skincare, nail studios.",
          "**Real Estate & Property** — agencies, developers, short-lets, vacation rentals, commercial leasing, interiors.",
          "**Automotive & Industrial** — repair workshops, spare parts, dealerships, car washes, logistics, haulage.",
          "**Hospitality & Tourism** — hotels, resorts, eco-lodges, tour operators, travel agencies, event centres, lounges.",
          "**Professional & Financial Services** — accounting, legal, microfinance, insurance, tech consultancies, education.",
          "**Agriculture & Agribusiness** — poultry, vegetable producers, fertiliser, farm equipment, solar irrigation.",
        ],
      },

      { t: "h2", text: "What the mapping encodes" },
      {
        t: "p",
        text: "For each industry: who the buyer is, what triggers the purchase, how long the consideration window is, which objection has to be answered on screen, and what kind of footage historically converts. A hotel ad sells a feeling months in advance. A mechanic's ad sells trust in eight seconds.",
      },
      {
        t: "stats",
        items: [
          { value: "329+", label: "Industries with demographic and creative models" },
          { value: "8", label: "Top-level commercial categories" },
          { value: "Per-market", label: "Models are regional, not globally averaged" },
        ],
      },
      {
        t: "p",
        text: "This mapping is what the [Enterprise Campaign Engine](/blog/enterprise-campaign-engine) is underwritten by — it is difficult to guarantee an outcome in a market you have not measured.",
      },
      {
        t: "callout",
        title: "Is your industry mapped?",
        body: "Most are. Tell us your sector and market and we'll tell you what we already know about your buyer.",
        cta: { label: "Talk to Enterprise", href: "/enterprise" },
      },
    ],
  },
];
