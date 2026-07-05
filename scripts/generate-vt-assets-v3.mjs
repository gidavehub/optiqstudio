/**
 * MASTER ASSET GENERATION SCRIPT (V3) - Virtual Teacher Rohey
 * 
 * Runs from the Optiq repository workspace (utilizing Optiq's authenticated Vertex AI project setup).
 * Generates all 9 updated, much longer audio WAV tracks using the custom Gambian voice profile.
 * Generates all 9 corresponding consistent gesture video loops using Vertex AI Veo (gemini-omni-flash-preview).
 * 
 * Saves all generated files directly into the virtualteacher workspace:
 *   c:\Projects\virtualteacher\public\media\
 * 
 * Prereq: gcloud auth application-default login
 * Run: node scripts/generate-vt-assets-v3.mjs
 */

import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, readFile, copyFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const LOCATION = "us-east4";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: "global"
});

const VEO = "gemini-omni-flash-preview";
const TTS = "gemini-3.1-flash-tts-preview";

// Target path directly into virtualteacher
const OUT = path.join(process.cwd(), "..", "virtualteacher", "public", "media");
const PUBLIC_ROOT = path.join(process.cwd(), "..", "virtualteacher", "public");

// 83-word typical deep Gambian female accent profile (distinct from Senegalese, heavy and natural)
const GAMBIAN_VOICE_PROFILE = "Voice profile: A vibrant, highly energetic, and deeply authentic young Gambian lady's voice speaking with a clear, heavy, and natural Gambian accent (distinctly Gambian, not Senegalese, with characteristic Gambian inflections, phonetic patterns, and warm speech rhythms). Her voice is rich, full-bodied, and carries a passionate, friendly, and lively human conversational tone. She speaks with a faster, enthusiastic, and highly engaging talking speed, filled with genuine excitement, warmth, and natural human breathing, completely free of any flat, robotic, or mechanical delivery.";

const AUDIOS = [
  {
    file: "rohey-hello.wav",
    text: "Good evening, my lovely class! Oh, look at this! I must say, I was not expecting our classroom to be so packed to the brim tonight! It warms my heart to see every single seat taken. Welcome, welcome, everyone. Seeing you all gathered here this evening truly, truly makes me so incredibly happy. Nafisa, my dear, it is absolutely lovely to have you with us in the front row tonight. Stephane, Turker, good evening to you both, thank you for coming! Ah, Franklin, and Karl! You made it as well! I am so glad you found your way to your desks. And Imma, welcome, welcome, it is a absolute pleasure to have you here in the room with us. To every single one of you, thank you all so much for taking the time to join us tonight. Welcome to my humble classroom. I know, I know... looking around, it is not much to look at, is it? There is no modern projector on the ceiling, no fancy tablets on the desks, and certainly no high-speed internet connection. Some mornings, we do not even have enough pieces of chalk to write on this old chalkboard. But you know what? Every single morning, without fail, they come. Thirty-two children, walking from all over, arriving right on time, with big smiles on their faces and hope in their eyes. Why? Because they believe with all their hearts that this simple classroom is a door. A magical door that could open opportunities to anywhere in this wide world.",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-breaks-heart.wav",
    text: "But you know what truly breaks my heart, class? Right now, at this very moment, that door does not open very far for my students. Let me tell you some numbers. There are exactly 1,978 basic and secondary level schools scattered across our beautiful country of The Gambia. Every single one of these schools has now been mapped, down to the exact GPS coordinates, thanks to the incredible Giga Initiative—which is a wonderful global partnership led by UNICEF and the International Telecommunication Union. Because of them, we can see every single school on the digital map. We know exactly where they are, we know their locations. But class, look closely. Can you spot the grand, tragic problem? Let me help you find it. Look at all those red dots covering the screen. Those red dots represent schools that do not have a single byte of internet connection. Can you see them? They are everywhere. This is the reality. Seeing them is a massive step forward, yes, but seeing does not equal solving. Our school right here is one of those unconnected red dots. As a teacher, I know deep inside that I should be preparing my eager students for the digital demands of the 21st century. But tell me, how can I teach them about the internet, about coding, or about world-changing technology when we do not even have a connection? There is only so much a teacher can do with just a chalkboard and books. We need the tools!",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-question.wav",
    text: "So tonight, my dear class, I am not going to stand up here and lecture you like a traditional teacher. No, no. Instead, I am going to do what the very best teachers do. I am going to ask you a question that challenges your imagination. I want you to think about this deeply: If every single child in The Gambia had high-speed, reliable internet access right at their school desk, how would you re-design education from the ground up? Think about this question. Let it sit in your mind. I want you to discuss it actively with your classmates at your tables. Share your wildest, most ambitious ideas. Oh! Just look at the clock! The time has flown by, and it is already time for our first break. Enjoy your discussions, talk to each other, and I will be back shortly to hear all of your brilliant ideas. Class dismissed for the break!",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-feedback.wav",
    text: "Alright, class, quiet down and settle back into your seats, please. I hope you all had a wonderful break and had enough time to really think about and discuss my question, because class is officially back in session! So, tell me, my brilliant students, what did you discuss at your tables? Come on, do not be shy with me! It is just a friendly classroom discussion; it is not like you are presenting in front of a giant room full of high-level ministers and international diplomats, right? Oh, wait... actually, you are! But do not worry, you are doing great. Yes, tell me... Ah! Remote learning! A classroom without walls! That is beautiful! Imagine a student in Basse connected in real-time to a classroom in Banjul, or even Dakar, or Lagos! And what is that? Teacher training? Thank you! Thank you so much! Finally, someone who remembers us, the hard-working teachers! If we train the teachers first, and then connect the schools, just imagine the incredible things that will become possible. And did someone say Artificial Intelligence? Yes! The safe, ethical use of AI is something I am a huge fan of, obviously. But let us be honest, class: AI is only as useful as the internet connection it actually runs on. If there is no internet, there is absolutely no AI. It is that simple, and that critical.",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-giga.wav",
    text: "Wow! You have really given me a lot of fantastic ideas to process here. This is a classic case of the students giving their teacher homework! What a clever, clever class you are. But let me tell you a secret: what you have just imagined and discussed is not just a dream. It is already being accomplished in real life all around the globe by Giga! Let us look at Sierra Leone, for example. The cost of connecting a single school dropped from a massive twelve thousand dollars down to just one thousand five hundred dollars per year—that is an incredible ninety percent drop in upfront and running costs! This changed the entire game, making internet connectivity affordable and sustainable for long-term growth. And let us travel to the Kakuma refugee camp in Kenya. There, a young girl named Darlene is learning to code, building websites, and imagining a vibrant professional future far, far beyond the physical boundaries of the camp. In fact, across Kenya, Giga has connected six hundred and fifty-nine schools, reaching over four hundred and twenty-five thousand students! You see, when school connectivity is done right, it is not just about technology. It becomes pure, living hope for a better future.",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-gambia.wav",
    text: "And what about right here at home in our beloved country of The Gambia? Things are moving fast! In May, our very own Vice President officially signed our letter of interest to join Giga. That signature kicked off a massive, nationwide mapping exercise. And now, as we speak, every single one of those one thousand nine hundred and seventy-eight schools is fully mapped and visible on the platform! Even better, our technical vocational institutions and community health facilities are being added to the map right now, which helps us share and reduce the upfront infrastructure costs for everyone. We have successfully completed the mapping. We have finished the detailed planning. What we need now, my friends, is the doing. The action! Think about that. Oh, look at the time again! It is time for another break. Please, enjoy your wonderful meal. But when you come back to your desks, we are going to talk about something a little more serious, but incredibly important for the future of our youth.",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-turning-point.wav",
    text: "I truly hope that what you have seen and heard tonight felt real to you. Because let me tell you, it can be absolutely real! We are standing at a historic turning point. The schools of The Gambia are mapped, the partners are ready, and UNICEF is standing right here with us. The only thing that is missing now is the final, most crucial ingredient: You. Your support, your commitment. And let us be very clear, this is not about charity. Not at all. This is a high-return investment! In a country where over sixty percent of our entire population is under the age of twenty-five, the return on this investment is not just financial. The return is the next generation of proud Gambian engineers, scientists, doctors, and tech leaders, fully equipped to build leading industries right here at home rather than risking their precious lives on dangerous journeys abroad. Furthermore, connecting our mapped health facilities will turn them into modern nodes of telehealth, bringing specialist pediatric medical care directly to our most remote rural villages. This is the future we are investing in.",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-commitment.wav",
    text: "So, class, as your teacher tonight, I have one final question for you. And this time, I am absolutely not going to let you answer it over dinner or discuss it later! The question is written right here on my whiteboard: What concrete, actionable thing can you and your organization do right now to help connect every single school, health facility, and technical training center in The Gambia? To help you answer, my lovely class monitors wearing the blue shirts will be coming to each of your tables in just a moment. They are handing out commitment cards. We want to hear your real answers tonight, before you leave this classroom. Please write down your best ideas and commitments, and I would love for some of you to stand up and share them with the class. Raise your hand high, and let us hear your voice!",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  },
  {
    file: "rohey-closing.wav",
    text: "Oh, wow! These are absolutely fantastic, inspiring ideas and commitments! My heart is so incredibly warm hearing your voices tonight. But please, please do not let this be just another evening of talk. We must all walk the talk together—because our children, our future, are counting on every single one of us in this room. You know, when I first started my journey as a teacher, a wise mentor told me something I will never forget. They said: Rohey, the very best teachers do not just give their students answers. No, they give them the right questions, and the courage to act upon them. Well, class, you have had the right question in front of you all evening. My thirty-two eager students in The Gambia are counting on your courage to act. Thank you all, and class is officially dismissed.",
    style: GAMBIAN_VOICE_PROFILE,
    voice: "Kore"
  }
];

const VIDEOS = [
  {
    file: "rohey-walk-in.mp4",
    prompt: "Bring this avatar to life. Rohey is a friendly young Gambian female teacher. She is walking into a bare, dimly lit classroom carrying a folder. There is child noise around. She sets the folder down on her desk, looks directly at the camera, smiles, and raises her hand in a warm, gentle gesture to ask everyone to quiet down. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-hello.mp4",
    prompt: "Bring this avatar to life. Rohey is speaking, smiling, and waving hello warmly, welcoming everyone and greeting Nafisa, Stephane, Franklin, Karl, and Imma with massive energy and a broad, friendly smile. Camera remains completely static. The background classroom, seating, blackboard, and pupils behind remain absolutely identical to the reference image."
  },
  {
    file: "rohey-breaks-heart.mp4",
    prompt: "Bring this avatar to life. Rohey is explaining what breaks her heart. She looks sincere, serious, and deeply concerned, gesturing slowly with both hands in front of her chest to show empathy. She does NOT point to any map on the wall. Camera remains completely static. Her traditional yellow/blue dress and her facial structure are 100% consistent with the reference image."
  },
  {
    file: "rohey-question.mp4",
    prompt: "Bring this avatar to life. Rohey stands in front of the chalkboard, holding a piece of chalk, writing on the board, and then turns back to face the camera, looking at her watch with a friendly smile, asking the students to discuss the question. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-listening.mp4",
    prompt: "Bring this avatar to life. Rohey is in silent listening standby mode. She is looking forward, nodding her head slightly, blinking naturally, and listening attentively with a warm, caring, and encouraging facial expression. Camera remains completely static. The background classroom remains absolutely identical to the reference image. No speech, just natural silent listening and nodding."
  },
  {
    file: "rohey-pointing-left.mp4",
    prompt: "Bring this avatar to life. Rohey stands looking at the camera, smiles warmly, and points her hand gracefully to the left side of the room (Tables 1 & 2), nodding in encouragement. Camera remains completely static. The background classroom remains absolutely identical to the reference image. Silent loop."
  },
  {
    file: "rohey-looking-center.mp4",
    prompt: "Bring this avatar to life. Rohey stands looking forward, nods in approval, and gestures with both hands towards the center of the room, smiling and listening attentively. Camera remains completely static. The background classroom remains absolutely identical to the reference image. Silent loop."
  },
  {
    file: "rohey-pointing-right.mp4",
    prompt: "Bring this avatar to life. Rohey stands looking at the camera, smiles warmly, and points her hand gracefully to the right side of the room (Tables 3 & 4), nodding in encouragement. Camera remains completely static. The background classroom remains absolutely identical to the reference image. Silent loop."
  },
  {
    file: "rohey-feedback.mp4",
    prompt: "Bring this avatar to life. Rohey is showing enthusiastic positive feedback. She is smiling broadly, nodding her head in approval, and speaking energetically, delighted at the student's answer about remote learning. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-giga.mp4",
    prompt: "Bring this avatar to life. Rohey is explaining the Giga story with high enthusiasm. She is gesturing with her hands, talking, smiling, and teaching her class about connecting schools in Sierra Leone and Kenya, with photos of connected schools on the background screen. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-gambia.mp4",
    prompt: "Bring this avatar to life. Rohey stands explaining the progress in The Gambia with pride and confidence. She is talking, smiling warmly, and gesturing naturally to emphasize that every school is mapped. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-turning-point.mp4",
    prompt: "Bring this avatar to life. Rohey speaks with deep sincerity, hope, and determination. She is gesturing with her hands to emphasize her points about investing in the next generation of engineers and entrepreneurs. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-commitment.mp4",
    prompt: "Bring this avatar to life. Rohey smiles warmly, gestures to her table monitors in blue shirts, and writes the commitment question on her whiteboard. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  },
  {
    file: "rohey-closing.mp4",
    prompt: "Bring this avatar to life. Rohey is giving a humble parting lesson, smiling warmly, bowing gracefully, and waving goodbye to the class as she dismisses them. Camera remains completely static. The background classroom remains absolutely identical to the reference image."
  }
];

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

async function getAccessToken() {
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("No access token — run: gcloud auth application-default login");
  return t.token;
}

function pcmToWav(pcmBase64, sampleRate) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2; // mono, 16-bit
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function vertexFetch(endpoint, body) {
  const token = await getAccessToken();
  let url;
  if (endpoint.includes("gemini-3.1-flash") || endpoint.includes("gemini-omni-flash-preview") || endpoint.includes("gemini-3.5-flash")) {
    url = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global${endpoint}`;
  } else {
    url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}${endpoint}`;
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vertex Fetch failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function exists(file) {
  try {
    await access(path.join(OUT, file));
    return true;
  } catch {
    return false;
  }
}

async function generateTTS(audio) {
  // Always overwrite to ensure the new much longer scripts are applied
  console.log(`  … generating TTS: ${audio.file}`);
  
  const promptText = audio.style ? `${audio.style}:\n\n${audio.text}` : audio.text;
  
  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const data = await vertexFetch(`/publishers/google/models/${TTS}:generateContent`, {
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: audio.voice },
            },
          },
        },
      });

      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!part) throw new Error("No audio returned in response candidates");

      const rateMatch = part.mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      
      const wavBuffer = pcmToWav(part.data, sampleRate);
      await writeFile(path.join(OUT, audio.file), wavBuffer);
      console.log(`  ✓ Generated TTS: ${audio.file}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for ${audio.file} failed: ${err.message}`);
      if (i < attempts) {
        console.log(`  … waiting 10s before retry…`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        throw err;
      }
    }
  }
}

async function generateVideo(vid, imageBase64) {
  // Overwrite to ensure the fresh prompts and gestures are generated perfectly
  console.log(`  … generating Video: ${vid.file} (with image reference integration)`);
  
  const inputPayload = [
    {
      type: "user_input",
      content: [
        {
          type: "image",
          data: imageBase64,
          mime_type: "image/jpeg"
        },
        {
          type: "text",
          text: vid.prompt
        }
      ]
    }
  ];

  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const interaction = await ai.interactions.create({
        model: VEO,
        input: inputPayload
      });

      if (!interaction || !interaction.output_video || !interaction.output_video.data) {
        throw new Error("No video returned in interaction response");
      }

      const videoBuffer = Buffer.from(interaction.output_video.data, "base64");
      await writeFile(path.join(OUT, vid.file), videoBuffer);
      console.log(`  ✓ Generated Video: ${vid.file}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for ${vid.file} failed: ${err.message}`);
      if (i < attempts) {
        let sleepSecs = err.message.includes("429") ? 65 : 15;
        console.log(`  … waiting ${sleepSecs}s before retry…`);
        await new Promise(r => setTimeout(r, sleepSecs * 1000));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(PUBLIC_ROOT, { recursive: true });

  console.log(`Checking baseline avatar image at virtualteacher public/rohey-avatar.jpg...`);
  let masterImgBase64;
  try {
    const rawImg = await readFile(path.join(PUBLIC_ROOT, "rohey-avatar.jpg"));
    masterImgBase64 = rawImg.toString("base64");
    console.log(`  ✓ Successfully loaded baseline image.`);
  } catch (err) {
    console.error(`Baseline avatar image not found at virtualteacher public/rohey-avatar.jpg! ${err.message}`);
    process.exit(1);
  }

  console.log(`\n--- STEP 1: Generating Audio TTS Lesson Segments ---`);
  for (const audio of AUDIOS) {
    try {
      await generateTTS(audio);
    } catch (err) {
      console.error(`  ✗ Audio ${audio.file} failed: ${err.message}`);
    }
  }

  console.log(`\n--- STEP 2: Generating Consistent Video Segments ---`);
  for (const vid of VIDEOS) {
    try {
      // Small 20s delay cushion to handle rate limiting gracefully
      await new Promise(r => setTimeout(r, 20000));
      await generateVideo(vid, masterImgBase64);
    } catch (err) {
      console.error(`  ✗ Video ${vid.file} failed: ${err.message}`);
    }
  }

  console.log("\nMedia asset generation process complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
