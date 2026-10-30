import path from 'path';
import fsp from 'fs/promises';
import { app } from 'electron';
import JSZip from 'jszip';
import { importFile } from './file-import';
import { getBooks } from './database';

/**
 * Generate a complete, valid EPUB 2/3 file using JSZip.
 */
async function createEpubFile(
  destPath: string,
  options: {
    id: string;
    title: string;
    author: string;
    description: string;
    language?: string;
    coverSvg: string;
    chapters: { title: string; filename: string; content: string }[];
  }
): Promise<void> {
  const zip = new JSZip();

  // 1. mimetype (MUST be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. Cover SVG
  zip.file('OEBPS/cover.svg', options.coverSvg);

  // 4. Chapters
  for (const ch of options.chapters) {
    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${options.title} - ${ch.title}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 5%; }
    h1 { text-align: center; margin-bottom: 2em; font-family: sans-serif; }
    p { text-indent: 1.5em; margin: 0.5em 0; }
    p.initial { text-indent: 0; }
    p.initial::first-letter { font-size: 2.5em; float: left; margin: 0.1em 0.2em 0 0; line-height: 0.8; }
  </style>
</head>
<body>
  <h1>${ch.title}</h1>
  ${ch.content}
</body>
</html>`;
    zip.file(`OEBPS/${ch.filename}`, xhtml);
  }

  // 5. NCX Table of Contents
  const navPoints = options.chapters
    .map(
      (ch, idx) => `
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${ch.title}</text></navLabel>
      <content src="${ch.filename}"/>
    </navPoint>`
    )
    .join('');

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${options.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${options.title}</text></docTitle>
  <docAuthor><text>${options.author}</text></docAuthor>
  <navMap>
    ${navPoints}
  </navMap>
</ncx>`
  );

  // 6. content.opf
  const manifestItems = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/>`,
    ...options.chapters.map(
      (ch, idx) =>
        `<item id="chapter-${idx + 1}" href="${ch.filename}" media-type="application/xhtml+xml"/>`
    ),
  ].join('\n    ');

  const spineRefs = options.chapters
    .map((_, idx) => `<itemref idref="chapter-${idx + 1}"/>`)
    .join('\n    ');

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookID">${options.id}</dc:identifier>
    <dc:title>${options.title}</dc:title>
    <dc:creator>${options.author}</dc:creator>
    <dc:language>${options.language || 'en'}</dc:language>
    <dc:description>${options.description}</dc:description>
    <meta name="cover" content="cover"/>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineRefs}
  </spine>
</package>`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await fsp.writeFile(destPath, buffer);
}

/**
 * Generate SVG covers with rich typographic and gradient styling.
 */
function generateCoverSvg(title: string, author: string, gradient: [string, string], iconSvg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </linearGradient>
    <linearGradient id="spineShade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="25%" stop-color="#fff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="600" height="900" fill="url(#bgGrad)"/>

  <!-- Ornaments & Borders -->
  <rect x="30" y="30" width="540" height="840" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" rx="8"/>
  <rect x="42" y="42" width="516" height="816" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" rx="4"/>

  <!-- Center Artwork Icon -->
  <g transform="translate(250, 260) scale(4)" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5">
    ${iconSvg}
  </g>

  <!-- Title -->
  <text x="300" y="460" font-family="Georgia, serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">
    ${title.split(' - ')[0]}
  </text>
  ${
    title.split(' - ')[1]
      ? `<text x="300" y="505" font-family="Georgia, serif" font-size="22" font-style="italic" fill="rgba(255,255,255,0.85)" text-anchor="middle">
    ${title.split(' - ')[1]}
  </text>`
      : ''
  }

  <!-- Divider -->
  <line x1="220" y1="540" x2="380" y2="540" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>

  <!-- Author -->
  <text x="300" y="590" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="600" fill="rgba(255,255,255,0.9)" text-anchor="middle" letter-spacing="3">
    ${author.toUpperCase()}
  </text>

  <!-- Bottom Classic Edition Tag -->
  <text x="300" y="810" font-family="'Segoe UI', sans-serif" font-size="12" fill="rgba(255,255,255,0.5)" text-anchor="middle" letter-spacing="4">
    PAGETURN COLLECTOR'S EDITION
  </text>

  <!-- Book Spine 3D Lighting Effect -->
  <rect x="0" y="0" width="35" height="900" fill="url(#spineShade)"/>
</svg>`;
}

/**
 * Seed 3 classic, beautifully formatted books when the library is empty.
 */
export async function seedSampleBooks(): Promise<number> {
  const samplesDir = path.join(app.getPath('userData'), 'samples');
  await fsp.mkdir(samplesDir, { recursive: true });

  const book1Path = path.join(samplesDir, 'alice_in_wonderland.epub');
  const book2Path = path.join(samplesDir, 'great_gatsby.epub');
  const book3Path = path.join(samplesDir, 'sherlock_holmes.epub');

  // Book 1: Alice's Adventures in Wonderland
  const aliceSvg = generateCoverSvg(
    "Alice's Adventures - in Wonderland",
    'Lewis Carroll',
    ['#2c3e50', '#3498db'],
    `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`
  );

  await createEpubFile(book1Path, {
    id: 'pt-alice-wonderland',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    description: 'A young girl named Alice falls through a rabbit hole into a subterranean fantasy world populated by peculiar anthropomorphic creatures.',
    coverSvg: aliceSvg,
    chapters: [
      {
        title: 'Chapter I: Down the Rabbit-Hole',
        filename: 'chapter1.xhtml',
        content: `
          <p class="initial">Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"</p>
          <p>So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.</p>
          <p>There was nothing so VERY remarkable in that; nor did Alice think it so VERY much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be late!" But when the Rabbit actually TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it.</p>
          <p>Burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge. In another moment down went Alice after it, never once considering in the world how she was to get out again.</p>
          <p>The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.</p>
        `,
      },
      {
        title: 'Chapter II: The Pool of Tears',
        filename: 'chapter2.xhtml',
        content: `
          <p class="initial">"Curiouser and curiouser!" cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); "now I’m opening out like the largest telescope that ever was! Good-bye, feet!"</p>
          <p>Just at this moment her head struck against the roof of the hall: in fact she was now more than nine feet high, and she at once took up the little golden key and hurried off to the garden door.</p>
          <p>Poor Alice! It was as much as she could do, lying down on one side, to look through into the garden with one eye; but to get through was more hopeless than ever: she sat down and began to cry again.</p>
          <p>"You ought to be ashamed of yourself," said Alice, "a great girl like you, to go on crying in this way! Stop this moment, I tell you!" But she went on all the same, shedding gallons of tears, until there was a large pool all round her, about four inches deep and reaching half down the hall.</p>
        `,
      },
      {
        title: 'Chapter III: A Caucus-Race and a Long Tale',
        filename: 'chapter3.xhtml',
        content: `
          <p class="initial">They were indeed a queer-looking party that assembled on the bank—the birds with draggled feathers, the animals with their fur clinging close to them, and all dripping wet, cross, and uncomfortable.</p>
          <p>The first question of course was, how to get dry again: they had a consultation about this, and after a few minutes it seemed quite natural to Alice to find herself talking familiarly with them, as if she had known them all her life.</p>
          <p>"What I was going to say," said the Dodo in an offended tone, "was, that the best thing to get us dry would be a Caucus-race."</p>
          <p>"What is a Caucus-race?" said Alice; not that she wanted much to know, but the Dodo had paused as if it thought that SOMEBODY ought to speak, and no one else seemed inclined to say anything.</p>
        `,
      },
    ],
  });

  // Book 2: The Great Gatsby
  const gatsbySvg = generateCoverSvg(
    'The Great Gatsby',
    'F. Scott Fitzgerald',
    ['#111827', '#4f46e5'],
    `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>`
  );

  await createEpubFile(book2Path, {
    id: 'pt-great-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    description: 'Set in Jazz Age New York, the novel depicts narrator Nick Carraway’s interactions with mysterious millionaire Jay Gatsby and Gatsby’s obsession to reunite with his former lover, Daisy Buchanan.',
    coverSvg: gatsbySvg,
    chapters: [
      {
        title: 'Chapter I',
        filename: 'chapter1.xhtml',
        content: `
          <p class="initial">In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since.</p>
          <p>"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven’t had the advantages that you’ve had."</p>
          <p>He didn’t say any more, but we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I’m inclined to reserve all judgements, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.</p>
          <p>When I came back from the East last autumn I felt that I wanted the world to be in uniform and at a sort of moral attention forever; I wanted no more riotous excursions with privileged glimpses into the human heart. Only Gatsby, the man who gives his name to this book, was exempt from my reaction—Gatsby, who represented everything for which I have an unaffected scorn.</p>
        `,
      },
      {
        title: 'Chapter II',
        filename: 'chapter2.xhtml',
        content: `
          <p class="initial">About half way between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land. This is a valley of ashes—a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens.</p>
          <p>Above the grey land and the spasms of bleak dust which drift endlessly over it, you perceive, after a moment, the eyes of Doctor T. J. Eckleburg. The eyes of Doctor T. J. Eckleburg are blue and gigantic—their retinas are one yard high. They look out of no face, but, instead, from a pair of enormous yellow spectacles which pass over a non-existent nose.</p>
        `,
      },
    ],
  });

  // Book 3: The Adventures of Sherlock Holmes
  const sherlockSvg = generateCoverSvg(
    'Adventures of - Sherlock Holmes',
    'Arthur Conan Doyle',
    ['#1f2937', '#b45309'],
    `<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>`
  );

  await createEpubFile(book3Path, {
    id: 'pt-sherlock-holmes',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    description: 'A collection of twelve short stories featuring the famous consulting detective Sherlock Holmes and his companion Dr. John H. Watson.',
    coverSvg: sherlockSvg,
    chapters: [
      {
        title: 'I. A Scandal in Bohemia',
        filename: 'chapter1.xhtml',
        content: `
          <p class="initial">To Sherlock Holmes she is always THE woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.</p>
          <p>He was, I take it, the most perfect reasoning and observing machine that the world has seen, but as a lover he would have placed himself in a false position. He never spoke of the softer passions, save with a gibe and a sneer. They were admirable things for the observer—excellent for drawing the veil from men’s motives and actions. But for the trained reasoner to admit such intrusions into his own delicate and finely adjusted temperament was to introduce a distracting factor which might throw a doubt upon all his mental results.</p>
          <p>One night—it was on the twentieth of March, 1888—I was returning from a journey to a patient, when my way led me through Baker Street. As I passed the well-remembered door, which must always be associated in my mind with my wooing, and with the dark incidents of the Study in Scarlet, I was seized with a keen desire to see Holmes again, and to know how he was employing his extraordinary powers.</p>
        `,
      },
      {
        title: 'II. The Red-Headed League',
        filename: 'chapter2.xhtml',
        content: `
          <p class="initial">I had called upon my friend, Mr. Sherlock Holmes, one day in the autumn of last year and found him in deep conversation with a very stout, florid-faced, elderly gentleman with fiery red hair.</p>
          <p>With an apology for my intrusion, I was about to withdraw when Holmes pulled me abruptly into the room and closed the door behind me.</p>
          <p>"You could not have come at a better time, my dear Watson," he said cordially.</p>
          <p>"I was afraid that you were engaged."</p>
          <p>"So I am. Very much so."</p>
          <p>"Then I can wait in the next room."</p>
          <p>"Not at all. This gentleman, Mr. Wilson, has been my partner and helper in many of my most successful cases, and I have no doubt that he will be of the utmost use to me in yours also."</p>
        `,
      },
    ],
  });

  // Import all 3 books into SQLite
  let importedCount = 0;
  for (const fp of [book1Path, book2Path, book3Path]) {
    try {
      await importFile(fp);
      importedCount++;
    } catch (e) {
      console.warn('Failed to import sample book:', fp, e);
    }
  }

  return importedCount;
}

