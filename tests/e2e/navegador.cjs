// Opções do navegador de teste. O mundo em 3D é pesado para a renderização por
// software (SwiftShader, o padrão do Chromium sem janela): no Windows usamos a
// placa de vídeo pelo ANGLE/Direct3D. Em outros sistemas (ou sem GPU) o
// Chromium volta sozinho para o SwiftShader. E2E_SEM_GPU=1 força o software.
const gpuArgs =
  process.platform === 'win32' && !process.env.E2E_SEM_GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : [];

module.exports = { launchOptions: { args: gpuArgs } };
