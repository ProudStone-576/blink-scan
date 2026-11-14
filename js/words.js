const KEY = "blink-scan-words";

// roughly by frequency, plus words people use in everyday conversation
const BASE = (
  "the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my " +
  "one all would there their what so up out if about who get which go me when make can like time no just him know take people " +
  "into year your good some could them see other than then now look only come its over think also back after use two how our " +
  "work first well way even new want because any these give day most us hello hi thanks thank please sorry yes okay love family " +
  "friend news tell happened really water food home kids mother father sister brother husband wife son daughter doctor nurse " +
  "today tomorrow yesterday morning night tonight hungry thirsty tired pain hurts cold hot help need feel feeling better worse " +
  "happy sad angry worried scared glad miss missing visit coming call phone tv music pray church sleep rest eat drink bed pillow " +
  "blanket light window door open close turn off on more less little much very too always never maybe sure right wrong true " +
  "funny story told heard said saying whole everyone somebody anything nothing everything where why here there again still " +
  "already soon later wait stay leave bring talk listen read write watch laugh smile cry hold hand touch kiss hug lovely " +
  "beautiful nice kind sweet gossip secret rumour neighbour neighbours wedding birthday party festival dinner lunch breakfast tea " +
  "coffee juice medicine pill hospital home going gone should must might shall let am is are was were been being did does done"
).split(" ");

// Punjabi written in English letters, the way the family types it (with a few English words mixed in, as people do)
const PA_BASE = (
  "mainu tainu main tu tusi assi eh oh ki kive kiddan kithe kado kyon kaun haan ji nahin theek changa bura bahut thoda hor hun fer " +
  "ajj kal savere shaam raat roti paani chah dudh dawai dard bukhar thakaan neend ghar parivar putt puttar dhee beta beti veer bhen " +
  "mummy papa nani dadi massi chacha bhua mama jaana aana karna dena lena dekhna sunna bolna khaana peena sona baithna chahida " +
  "chahidi hai si hove ho rahi rahe gaya gayi aaya aayi das dass kujh kuch sab kise kisne mere tere sade tuhade naal ton nu ch vich " +
  "te par ruko chalo zara jaldi haule nede door shukriya meharbani maaf sat sri akal rabba haye sachi pata pyar khushi udaas dukh " +
  "gussa darr chinta rab washroom madad sehmat gal navi"
).split(" ");

const STARTERS = { en: ["i", "please", "thank", "yes"], pa: ["mainu", "haan", "nahin", "puttar"] };

const rankMap = (words) => new Map(words.map((word, i) => [word, i]));
const RANKS = { en: rankMap(BASE), pa: rankMap([...PA_BASE, ...BASE]) };
const POOLS = { en: BASE, pa: [...PA_BASE, ...BASE] };

let learned = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

// `lang` is "en" or "pa"; Punjabi mode ranks Punjabi words first and still offers English ones
export function predict(prefix, count = 4, lang = "en") {
  const p = prefix.toLowerCase();
  if (!p) {
    const top = Object.entries(learned)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word]) => word);
    for (const word of STARTERS[lang]) if (top.length < count && !top.includes(word)) top.push(word);
    return top;
  }
  const rank = (word) => RANKS[lang].get(word) ?? 9999;
  const pool = new Set([...POOLS[lang], ...Object.keys(learned)]);
  return [...pool]
    .filter((word) => word.startsWith(p) && word !== p)
    .sort((a, b) => (learned[b] ?? 0) - (learned[a] ?? 0) || rank(a) - rank(b) || a.length - b.length)
    .slice(0, count);
}

export function learn(text) {
  for (const word of text.toLowerCase().match(/[a-z']+/g) ?? []) {
    learned[word] = (learned[word] ?? 0) + 1;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(learned));
  } catch {
    // private mode: learning lasts for this session only
  }
}
