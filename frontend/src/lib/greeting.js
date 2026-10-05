// Picks the greeting shown under the hero: time of day in Burdwan (India time, whatever the visitor's own clock says),
// a festival or national-day wish when it is that day, and a friendlier line for people who have been here before.

// Fixed-date days (month is 1-12). Every year.
const FIXED = [
  { m: 1, d: 1, id: "newyear", emoji: "🎉", en: ["Happy New Year!", "A fresh year, a fresh start. May it bring you a home you love."], bn: ["শুভ নববর্ষ!", "নতুন বছর, নতুন শুরু। এই বছর আপনার পছন্দের বাড়িটি মিলুক।"] },
  { m: 1, d: 26, id: "republic", emoji: "🇮🇳", en: ["Happy Republic Day!", "Jai Hind. A home of your own is the most personal kind of freedom."], bn: ["প্রজাতন্ত্র দিবসের শুভেচ্ছা!", "জয় হিন্দ। নিজের একটা বাড়ি, স্বাধীনতার সবচেয়ে আপন রূপ।"] },
  { m: 8, d: 15, id: "independence", emoji: "🇮🇳", en: ["Happy Independence Day!", "Jai Hind. Here is to the freedom of a home that is truly yours."], bn: ["স্বাধীনতা দিবসের শুভেচ্ছা!", "জয় হিন্দ। নিজের বাড়ির স্বাধীনতা সবার হোক।"] },
  { m: 10, d: 2, id: "gandhi", emoji: "🕊️", en: ["Gandhi Jayanti: remembering Bapu today", "Honesty and simplicity are how we like to do business too. No pressure today, just good homes to look at."], bn: ["গান্ধী জয়ন্তী: আজ বাপুকে স্মরণ", "সততা আর সরলতা, আমরাও এভাবেই কাজ করতে ভালোবাসি। আজ কোনো তাড়া নেই, শুধু ভালো বাড়ি দেখা।"] },
  { m: 12, d: 25, id: "christmas", emoji: "🎄", en: ["Merry Christmas!", "Wishing you a warm and happy day at home."], bn: ["শুভ বড়দিন!", "আপনার ঘরে আজ উষ্ণতা আর আনন্দ থাকুক।"] },
];

// Festivals that move every year. Add the next year's dates here (YYYY-MM-DD, inclusive) each January.
// Sources: published Hindu panchang calendars; Bengal's Durga Puja runs Shashthi to Dashami.
const MOVABLE = [
  { id: "holi", emoji: "🎨", from: "2026-03-04", to: "2026-03-04", en: ["Happy Holi!", "May your day be full of colour. Home is where the best ones are celebrated."], bn: ["শুভ দোল ও হোলি!", "আপনার দিনটি রঙে ভরে উঠুক।"] },
  { id: "holi", emoji: "🎨", from: "2027-03-22", to: "2027-03-22", en: ["Happy Holi!", "May your day be full of colour. Home is where the best ones are celebrated."], bn: ["শুভ দোল ও হোলি!", "আপনার দিনটি রঙে ভরে উঠুক।"] },
  { id: "boishakh", emoji: "🪔", from: "2026-04-15", to: "2026-04-15", en: ["Shubho Noboborsho!", "A happy and prosperous Bengali New Year to you and your family."], bn: ["শুভ নববর্ষ!", "আপনার ও পরিবারের নতুন বছর সুখ ও সমৃদ্ধিতে ভরে উঠুক।"] },
  { id: "boishakh", emoji: "🪔", from: "2027-04-15", to: "2027-04-15", en: ["Shubho Noboborsho!", "A happy and prosperous Bengali New Year to you and your family."], bn: ["শুভ নববর্ষ!", "আপনার ও পরিবারের নতুন বছর সুখ ও সমৃদ্ধিতে ভরে উঠুক।"] },
  { id: "ganesh", emoji: "🐘", from: "2026-09-14", to: "2026-09-14", lead: 2, en: ["Ganpati Bappa Morya!", "Happy Ganesh Chaturthi. May Bappa clear the way to your new home."], bn: ["গণপতি বাপ্পা মোরিয়া!", "গণেশ চতুর্থীর শুভেচ্ছা। বাপ্পা আপনার নতুন বাড়ির পথ সুগম করুন।"] },
  { id: "ganesh", emoji: "🐘", from: "2027-09-04", to: "2027-09-04", lead: 2, en: ["Ganpati Bappa Morya!", "Happy Ganesh Chaturthi. May Bappa clear the way to your new home."], bn: ["গণপতি বাপ্পা মোরিয়া!", "গণেশ চতুর্থীর শুভেচ্ছা। বাপ্পা আপনার নতুন বাড়ির পথ সুগম করুন।"] },
  { id: "durga", emoji: "🙏", from: "2026-10-16", to: "2026-10-21", lead: 6, en: ["Shubho Pujo!", "Wishing you and your family a joyful Durga Puja. Pandal hopping first, home hunting after."], bn: ["শুভ পূজো!", "আপনাকে ও আপনার পরিবারকে দুর্গাপূজার অনেক শুভেচ্ছা। আগে ঠাকুর দেখা, তারপর বাড়ি দেখা।"], soon: ["Durga Puja is almost here", "Pujo is round the corner. Plan your home visits before the pandal crowds begin."], soonBn: ["পুজো প্রায় এসে গেল", "পুজো আসছে। ঠাকুর দেখার ভিড়ের আগেই বাড়ি দেখে নিন।"] },
  { id: "durga", emoji: "🙏", from: "2027-10-04", to: "2027-10-09", lead: 6, en: ["Shubho Pujo!", "Wishing you and your family a joyful Durga Puja. Pandal hopping first, home hunting after."], bn: ["শুভ পূজো!", "আপনাকে ও আপনার পরিবারকে দুর্গাপূজার অনেক শুভেচ্ছা। আগে ঠাকুর দেখা, তারপর বাড়ি দেখা।"], soon: ["Durga Puja is almost here", "Pujo is round the corner. Plan your home visits before the pandal crowds begin."], soonBn: ["পুজো প্রায় এসে গেল", "পুজো আসছে। ঠাকুর দেখার ভিড়ের আগেই বাড়ি দেখে নিন।"] },
  { id: "kali", emoji: "🪔", from: "2026-11-08", to: "2026-11-08", en: ["Shubho Kali Puja and Happy Diwali!", "May light fill your home, and may the next one you buy be a lucky one."], bn: ["শুভ কালীপূজা ও দীপাবলি!", "আপনার ঘর আলোয় ভরে উঠুক।"] },
  { id: "kali", emoji: "🪔", from: "2027-10-29", to: "2027-10-29", en: ["Shubho Kali Puja and Happy Diwali!", "May light fill your home, and may the next one you buy be a lucky one."], bn: ["শুভ কালীপূজা ও দীপাবলি!", "আপনার ঘর আলোয় ভরে উঠুক।"] },
];

const DAY = 86400000;

/** Today's calendar date in India as {y, m, d, hour}. */
export function indiaNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(now).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  return { y: +parts.year, m: +parts.month, d: +parts.day, hour: +parts.hour };
}

const dayNumber = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
const isoDay = (s) => { const [y, m, d] = s.split("-").map(Number); return dayNumber(y, m, d); };

export function timeOfDay(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** The special day for this date, or null. {id, emoji, title, text, upcoming} in the given language ("en" | "bn"). */
export function specialDay(now = new Date(), lang = "en") {
  const { y, m, d } = indiaNow(now);
  const today = dayNumber(y, m, d);
  for (const f of FIXED) {
    if (f.m === m && f.d === d) return { id: f.id, emoji: f.emoji, title: f[lang][0], text: f[lang][1], upcoming: false };
  }
  for (const f of MOVABLE) {
    const from = isoDay(f.from), to = isoDay(f.to);
    if (today >= from && today <= to) return { id: f.id, emoji: f.emoji, title: f[lang][0], text: f[lang][1], upcoming: false };
    if (f.soon && today >= from - (f.lead || 0) && today < from) {
      const s = lang === "bn" ? f.soonBn : f.soon;
      return { id: f.id, emoji: f.emoji, title: s[0], text: s[1], upcoming: true };
    }
  }
  return null;
}

const HELLO = {
  en: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Burning the midnight oil" },
  bn: { morning: "সুপ্রভাত", afternoon: "শুভ অপরাহ্ন", evening: "শুভ সন্ধ্যা", night: "এত রাতেও জেগে" },
};

// casual follow-up lines per time of day (first visit / returning); one is chosen per day so it never flickers
const LINES = {
  en: {
    new: {
      morning: ["Grab your chai and see the homes we picked this week.", "Start the day by finding a place you could call yours."],
      afternoon: ["Taking a break? Take a peek at our latest property tours.", "Between meetings? A two-minute tour is on us."],
      evening: ["Evening scroll? Make it a house-hunting one.", "Unwind with a few home tours from around Burdwan."],
      night: ["Can't sleep? Our property tours are better than another reel.", "Late-night browsing is fine, the homes will still be here in the morning."],
    },
    back: {
      morning: ["Back again? Let's check what's new.", "Chai ready? New listings are waiting."],
      afternoon: ["Welcome back! Let's see what's new today.", "Back for more? We added a few fresh ones."],
      evening: ["Back again? Let's check the new properties.", "Good to see you again. Fresh tours are up."],
      night: ["Back again, and this late? Let's check the new properties.", "Still thinking about that perfect home? Let's look again."],
    },
  },
  bn: {
    new: {
      morning: ["চা হাতে দেখে নিন এই সপ্তাহের বাছাই করা বাড়িগুলো।", "দিনটা শুরু করুন নিজের পছন্দের বাড়ি খুঁজে।"],
      afternoon: ["একটু বিরতি? আমাদের নতুন প্রপার্টি ট্যুরগুলো দেখে নিন।", "কাজের ফাঁকে দু'মিনিটের একটা ট্যুর হয়ে যাক।"],
      evening: ["সন্ধ্যায় স্ক্রল করছেন? আজ না হয় বাড়ি খোঁজার স্ক্রল হোক।", "বর্ধমানের কয়েকটা বাড়ির ট্যুর দেখে মন ভালো করুন।"],
      night: ["ঘুম আসছে না? আরেকটা রিলের চেয়ে আমাদের ট্যুর ভালো লাগবে।", "রাতে দেখুন, বাড়িগুলো সকালেও থাকবে।"],
    },
    back: {
      morning: ["আবার এসেছেন? দেখে নিই নতুন কী এল।", "চা তৈরি? নতুন লিস্টিং অপেক্ষা করছে।"],
      afternoon: ["আবার স্বাগত! দেখে নিই আজ নতুন কী এল।", "আবার এসেছেন? কয়েকটা নতুন বাড়ি যোগ হয়েছে।"],
      evening: ["আবার এসেছেন? চলুন নতুন প্রপার্টিগুলো দেখি।", "আপনাকে আবার দেখে ভালো লাগল। নতুন ট্যুর এসেছে।"],
      night: ["এত রাতে আবার? চলুন নতুন প্রপার্টিগুলো দেখি।", "সেই পছন্দের বাড়িটার কথা ভাবছেন? আবার দেখা যাক।"],
    },
  },
};

/**
 * @param {{now?: Date, lang?: "en"|"bn", name?: string|null, returning?: boolean, useName?: boolean}} o
 * `useName` is decided by the caller (about half the visits), so a signed-in person is greeted by name only sometimes.
 * @returns {{emoji: string, title: string, text: string, special: boolean}}
 */
export function buildGreeting({ now = new Date(), lang = "en", name = null, returning = false, useName = true } = {}) {
  const l = lang === "bn" ? "bn" : "en";
  const { hour, y, m, d } = indiaNow(now);
  const tod = timeOfDay(hour);
  const first = name ? String(name).trim().split(/\s+/)[0] : "";
  const call = useName ? first : "";   // the name is only spoken when asked to; being signed in still makes it a "welcome back"
  const sp = specialDay(now, l);
  if (sp) {
    return { emoji: sp.emoji, title: call && !sp.upcoming ? `${sp.title.replace(/[!.]$/, "")}, ${call}!` : sp.title, text: sp.text, special: true };
  }
  const pool = LINES[l][returning || first ? "back" : "new"][tod];
  const line = pool[(y * 372 + m * 31 + d) % pool.length];
  const hello = HELLO[l][tod];
  const emoji = { morning: "☀️", afternoon: "🌤️", evening: "🌇", night: "🌙" }[tod];
  const title = tod === "night" && l === "en" ? (call ? `${hello}, ${call}?` : `${hello}?`) : call ? `${hello}, ${call}!` : `${hello}!`;
  return { emoji, title, text: line, special: false };
}
