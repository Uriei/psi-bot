const fs = require('fs');
const path = require('path');
const myArgs = process.argv.slice(2);

(() => {
  const pathPackageJson = path.join('.', 'package.json');
  if (!fs.existsSync(pathPackageJson)) {
    console.error(
      `No se encuentra el fichero "package.json" en "${pathPackageJson}"`,
    );
    process.exit(1);
  }
  const packageJsonRaw = fs.readFileSync(pathPackageJson);
  if (!packageJsonRaw) {
    console.error(`El fichero "package.json" está vacío.`);
    process.exit(1);
  }
  const packageJson = JSON.parse(packageJsonRaw);
  const packageJsonDist = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    scripts: {
      start: 'node ./app.js',
      prestart: 'npm i --omit=dev',
    },
    dependencies: packageJson.dependencies,
    engines: packageJson.engines,
  };

  const pathPackageJsonDist = path.join('.', 'dist', 'package.json');
  fs.writeFileSync(
    pathPackageJsonDist,
    JSON.stringify(packageJsonDist, null, 2),
  );

  let pathEnvFile = path.join('.', '.env');
  if (myArgs.includes('dev')) {
    pathEnvFile = path.join('.', '.env.dev.local');
  } else {
    pathEnvFile = path.join('.', '.env.production.local');
  }
  fs.copyFileSync(pathEnvFile, path.join('.', 'dist', '.env'));
  fs.copyFileSync(
    path.join('.', 'scripts', 'copy', 'start.sh'),
    path.join('.', 'dist', 'start.sh'),
  );
})();
