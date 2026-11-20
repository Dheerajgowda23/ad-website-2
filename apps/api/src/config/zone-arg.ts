/**
 * `--zone public` / `--zone=internal` on the command line, or ZONE in the
 * environment. Kept in its own module and imported first so the zone is set
 * before any other module reads the environment.
 */
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const value = argv[index];
  if (value === '--zone') {
    const next = argv[index + 1];
    if (next) process.env.ZONE = next;
    break;
  }
  if (value?.startsWith('--zone=')) {
    process.env.ZONE = value.slice('--zone='.length);
    break;
  }
}
