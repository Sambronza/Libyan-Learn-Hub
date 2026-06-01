const fs = require('fs');

try {
  const content = fs.readFileSync('C:\\Users\\almes\\Downloads\\Libyan-Learn-Hub ・ Web Service ・ Render Dashboard.mht', 'utf8');

  const regex = /<span class="whitespace-pre-wrap break-words">([\s\S]*?)<\/span>/g;
  let match;
  const logs = [];
  while ((match = regex.exec(content)) !== null) {
    // Basic unescaping for common HTML entities
    let text = match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/=\r\n/g, '') // remove quoted-printable line breaks
      .trim();
    if (text) logs.push(text);
  }

  console.log("=== Extracted Logs (Last 50 lines) ===");
  console.log(logs.slice(-50).join('\n'));
} catch (e) {
  console.error(e);
}
