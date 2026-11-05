/**
 * Variáveis de ambiente repassadas ao processo do Claude Code. O SDK SUBSTITUI o ambiente
 * inteiro pelo que for passado, então só seguem as necessárias: nada do orquestrador
 * (como ACC_TOKEN) chega aos agentes.
 */
const PASS_THROUGH = [
  // sistema
  'PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM', 'SHELL', 'TMPDIR', 'TEMP', 'TMP',
  // Windows
  'SystemRoot', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'ComSpec', 'PATHEXT',
  // credenciais e configuração do Claude Code
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'AWS_REGION', 'AWS_PROFILE', 'CLOUD_ML_REGION', 'ANTHROPIC_VERTEX_PROJECT_ID',
  // rede corporativa
  'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE',
];

export function agentEnvironment(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of PASS_THROUGH) {
    const v = source[key];
    if (v !== undefined && v !== '') env[key] = v;
  }
  env.CLAUDE_AGENT_SDK_CLIENT_APP = 'ai-command-center/0.1';
  return env;
}
