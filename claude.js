exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing CLAUDE_API_KEY" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { imageBase64, mediaType, formData } = body;
  if (!imageBase64 || !mediaType) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing imageBase64 or mediaType" }) };
  }

  const fd = formData || {};
  const contextLines = [
    fd.numeAgent ? `Numele dat de stăpân: "${fd.numeAgent}"` : '',
    fd.specie ? `Specia: ${fd.specie}` : '',
    fd.nivel ? `Nivel experiență ales: ${fd.nivel}` : '',
    fd.misiune ? `Misiunea aleasă de stăpân: "${fd.misiune}"` : '',
    fd.abilitateUser ? `Abilitatea secretă dată de stăpân: "${fd.abilitateUser}"` : '',
  ].filter(Boolean).join('\n');

  const prompt = `Ești un analist de intelligence cu simț al umorului. Analizează această imagine cu un câine sau pisică și completează un DOSAR SECRET amuzant în română.

${contextLines ? `Date furnizate de stăpân:\n${contextLines}\n\nFolosește aceste date ca bază și completează ce lipsește cu creativitate.` : ''}

Răspunde DOAR cu un obiect JSON valid, fără markdown, fără backticks, fără text în afara JSON-ului:

{
  "numeCod": "Nume de cod spy amuzant și dramatic (ex: VULPEA NEAGRĂ, LABA DE OȚEL, BROTĂCELUL FURIOS)",
  "specie": "câine sau pisică (folosește datele stăpânului dacă sunt disponibile)",
  "rasa": "rasa animalului sau 'Nedeterminată / Clasificat' dacă nu e clară",
  "misiunePrincipala": "misiunea aleasă sau generată amuzant în 10-15 cuvinte",
  "abilitateSpeciala": "abilitatea dată de stăpân sau generată amuzant în 8-12 cuvinte",
  "nivelAmenintare": "unul din: RIDICOL / MODERAT / RIDICAT / EXTREM / CLASIFICAT",
  "codDosar": "număr dosar format HDG-2026-XXXX unde XXXX e random 4 cifre",
  "taglineSecret": "un tagline dramatic și amuzant de 5-8 cuvinte"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "Claude API error" }),
      };
    }

    const rawText = data.content?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Could not parse JSON from Claude response");
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
