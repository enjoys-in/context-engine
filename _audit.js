const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'data', 'commands');

const priority = ['composer','artisan','wp','symfony','gem','bundle','rails','rake','rspec','adb','fastlane','pod','xcodebuild','expo','react-native','prisma','drizzle-kit','typeorm','sequelize','alembic','flyway','liquibase','dbmate','atlas','stripe','twilio','auth0','trivy','snyk','sonar-scanner','yq','tmux','ng','vue','nuxt','docker-compose','k9s','minikube','pm2','docker','kubectl','helm','npm','pip','cargo','go','git','gh','pnpm','yarn','bun','conda','poetry','pipenv','terraform','pulumi','ansible','flask','django-admin','nest','next','vite','firebase','vercel','netlify','supabase','railway','flyctl','gcloud','az','aws','doctl'];

priority.forEach(name => {
  const fp = path.join(dir, name + '.json');
  if (!fs.existsSync(fp)) return;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const subs = data.subcommands || [];
    if (subs.length === 0) { console.log('NO_SUBS: ' + name); return; }
    let noOpts = 0;
    let noArgs = 0;
    subs.forEach(s => {
      if (!s.options || s.options.length === 0) noOpts++;
      if (!s.args || s.args.length === 0) noArgs++;
    });
    const pct = Math.round(noOpts / subs.length * 100);
    if (pct > 60) {
      console.log('SHALLOW: ' + name + ' (' + subs.length + ' subs, ' + pct + '% no opts)');
    }
  } catch (e) { console.log('ERROR: ' + name + ': ' + e.message); }
});
