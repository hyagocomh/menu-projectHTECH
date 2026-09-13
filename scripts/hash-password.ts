import { hash } from "bcryptjs";

const password = process.argv[2];

if (!password || password.length < 10) {
  console.error("Uso: npm run admin:hash -- 'uma-senha-com-10-ou-mais-caracteres'");
  process.exit(1);
}

console.log(await hash(password, 14));
