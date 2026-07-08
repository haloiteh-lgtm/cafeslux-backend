// Generates a unique, human-friendly gift card code, e.g. LUX-7K2P-9QXR
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LUX-${block()}-${block()}`;
}

module.exports = { generateCode };
