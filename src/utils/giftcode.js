// Generates a unique, human-friendly gift card code, e.g. LUXK-7FN2-RT4P-9QXR
// Format matches the frontend's own generateCode() (4 blocks of 4 chars)
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${block()}-${block()}-${block()}-${block()}`;
}

module.exports = { generateCode };
