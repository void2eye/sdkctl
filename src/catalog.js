export const SDK_TYPES = {
  java: {
    homeEnv: 'JAVA_HOME',
    executables: ['java', 'javac', 'jar', 'javadoc', 'jshell'],
    markers: [['bin', 'java']],
  },
  php: {
    homeEnv: 'PHP_HOME',
    executables: ['php', 'php-cgi'],
    markers: [['php']],
  },
  go: {
    homeEnv: 'GOROOT',
    executables: ['go', 'gofmt'],
    markers: [['bin', 'go']],
  },
  node: {
    homeEnv: 'NODE_HOME',
    executables: ['node', 'npm', 'npx', 'corepack'],
    markers: [['node']],
  },
  python: {
    homeEnv: 'PYTHON_HOME',
    executables: ['python', 'python3', 'pip', 'pip3'],
    markers: [['python']],
  },
};

export function normalizeSdkName(name) {
  const value = String(name || '').trim().toLowerCase();
  const aliases = { jdk: 'java', golang: 'go', py: 'python', nodejs: 'node' };
  return aliases[value] || value;
}

export function defaultDefinition(name) {
  return SDK_TYPES[name] || {
    homeEnv: `${name.toUpperCase().replace(/\W/g, '_')}_HOME`,
    executables: [name],
    markers: [],
  };
}
