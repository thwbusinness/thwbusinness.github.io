/* Winziger SMTP-Empfänger für Tests: nimmt Mails an und schreibt sie
   als JSON-Zeilen in eine Datei. Verschickt nichts weiter. */
const net = require("net");
const fs = require("fs");
const PORT = parseInt(process.env.SINK_PORT || "2525", 10);
const DATEI = process.env.SINK_FILE || "/tmp/smtp-sink.jsonl";

fs.writeFileSync(DATEI, "");

net.createServer((sock) => {
  let zustand = "befehl", puffer = "", mail = { an: [], daten: "" };
  sock.write("220 sink bereit\r\n");
  sock.on("data", (teil) => {
    puffer += teil.toString("utf8");
    let i;
    while ((i = puffer.indexOf("\r\n")) >= 0) {
      const zeile = puffer.slice(0, i);
      puffer = puffer.slice(i + 2);

      if (zustand === "daten") {
        if (zeile === ".") {
          fs.appendFileSync(DATEI, JSON.stringify({ ...mail, zeit: Date.now() }) + "\n");
          mail = { an: [], daten: "" };
          zustand = "befehl";
          sock.write("250 angenommen\r\n");
        } else {
          mail.daten += zeile + "\n";
        }
        continue;
      }

      const b = zeile.toUpperCase();
      if (b.startsWith("EHLO") || b.startsWith("HELO")) sock.write("250-sink\r\n250 OK\r\n");
      else if (b.startsWith("MAIL FROM")) { mail.von = zeile.slice(10); sock.write("250 OK\r\n"); }
      else if (b.startsWith("RCPT TO")) { mail.an.push(zeile.slice(8)); sock.write("250 OK\r\n"); }
      else if (b === "DATA") { zustand = "daten"; sock.write("354 los\r\n"); }
      else if (b === "QUIT") { sock.write("221 tschüss\r\n"); sock.end(); }
      else if (b === "RSET") { mail = { an: [], daten: "" }; sock.write("250 OK\r\n"); }
      else sock.write("250 OK\r\n");
    }
  });
  sock.on("error", () => {});
}).listen(PORT, () => console.log(`SMTP-Empfänger auf Port ${PORT}, schreibt nach ${DATEI}`));
