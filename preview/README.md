# Local card preview

Start the normal Vite dev server on port 5173 and open:

http://127.0.0.1:5173/preview/cards.html

Listening, Unit Checkpoint, Grammar, Practice, and Homework tabs show the same ten example states.
The Dictionary tab shows the full current dictionary layout with eight demo words, filters, status controls, audio buttons, and flippable cards.
Open Grammar directly with `/preview/cards.html?section=grammar`.
Open Practice directly with `/preview/cards.html?section=practice`.
Open Homework directly with `/preview/cards.html?section=homework`.
Open Dictionary directly with `/preview/cards.html?section=dictionary`.
Open Daily Review directly with `/preview/cards.html?section=dictionary&review=daily`.

The old `/work/listening-cards/preview.html` link points to the same entry.
The preview imports the actual `ContentCard`, `FileModal`, and `LockedModal` from
`src/pages/Dashboard.tsx`, so Vite updates it when the real UI changes. Do not copy
component implementations into this preview.

All examples are fictitious. Submission stores only the selected filename in
React state; it does not upload a file. Starting an interactive lesson simulates
a reviewed result. Reset clears these in-memory changes. Audio is a short local
test tone. No test user or database changes are required.

This is a separate development HTML entry, not an application route or an auth
bypass. It is not included in the default production build. The loopback URL
works only on this computer while the dev server is running.
