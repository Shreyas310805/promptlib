/* ==================================================================
   prompts-text.js — fill-in-the-blank text prompt templates.

   Loaded only by the four category pages (ppt / essay / report / email).
   index.html, images.html and builder.html have no use for it and do not
   pull it down.
   ================================================================== */
/* To add a new TEXT prompt: push {filename, prompt} into the matching array.
   [bracketed] words are auto-highlighted as fill-in variables — keep placeholders
   in that format. Each key (ppt/essay/report/email) feeds its own page:
   the page's #categoryPromptList element has a matching data-category attribute. */
window.textPromptsData = {
  ppt: [
    { filename:"ppt_01.txt", prompt:"Create a [number]-slide presentation outline on [topic] for a [audience type] audience. Include a title slide, an agenda, [number] content slides with 3 bullet points each, and a closing summary slide. Keep language [tone]." },
    { filename:"ppt_02.txt", prompt:"Turn the following notes into slide-ready bullet points, max 5 words per line, grouped under clear section headers: [paste notes]" },
    { filename:"ppt_03.txt", prompt:"Suggest a slide-by-slide structure for a [duration]-minute pitch deck for [product or idea], following a problem → solution → market → ask format." },
    { filename:"ppt_04.txt", prompt:"Write speaker notes for a slide titled '[slide title]', assuming the audience already knows [background context]. Keep it under 100 words, conversational tone." }
  ],
  essay: [
    { filename:"essay_01.txt", prompt:"Write a [word count]-word essay on [topic] in a [tone] tone. Structure it with an introduction that states a clear thesis, [number] body paragraphs each covering one supporting point, and a conclusion that restates the thesis without repeating it word-for-word." },
    { filename:"essay_02.txt", prompt:"Give me 5 possible thesis statements for an essay about [topic], each taking a slightly different angle." },
    { filename:"essay_03.txt", prompt:"Rewrite this paragraph to sound more [tone] while keeping the same meaning: [paste paragraph]" },
    { filename:"essay_04.txt", prompt:"Write a counter-argument paragraph for an essay arguing that [position], addressing the strongest opposing view and rebutting it in [word count] words." }
  ],
  report: [
    { filename:"report_01.txt", prompt:"Write a [report type] report on [topic] for [audience], structured as: Executive Summary, Background, Findings ([number] key points), Recommendations, Conclusion. Total length: [word count] words." },
    { filename:"report_02.txt", prompt:"Summarize the following data into a concise 'Key Findings' section with [number] bullet points, each starting with the most important number or result: [paste data]" },
    { filename:"report_03.txt", prompt:"Draft an executive summary for a report about [topic], written for [audience] who won't read the full report — under 200 words." },
    { filename:"report_04.txt", prompt:"Convert this list of raw observations into a formal 'Recommendations' section, phrased as clear action items: [paste observations]" }
  ],
  email: [
    { filename:"email_01.txt", prompt:"Write a [tone] email to [recipient] about [topic]. Keep it under [word count] words, include a clear subject line, and end with a specific call to action." },
    { filename:"email_02.txt", prompt:"Draft a follow-up email to [recipient] after [event or meeting], referencing [specific detail] and proposing [next step]." },
    { filename:"email_03.txt", prompt:"Write a polite decline email to [recipient] regarding [request], keeping the door open for future collaboration." },
    { filename:"email_04.txt", prompt:"Turn these rough notes into a professional email to [recipient]: [paste notes]. Tone: [tone]." }
  ]
};
