const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_IMAGE = 'C:\\Users\\USER\\Desktop\\20251223_161350.png';
const OUTPUT_DIR = path.join(__dirname, '..', 'packages', 'web', 'public');

// 생성할 파비콘 사이즈들
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

async function generateFavicons() {
  console.log('🎨 파비콘 생성 시작...\n');
  console.log(`📁 소스: ${SOURCE_IMAGE}`);
  console.log(`📁 출력: ${OUTPUT_DIR}\n`);

  // 출력 디렉토리 확인
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // PNG 파비콘들 생성
  for (const { name, size } of sizes) {
    const outputPath = path.join(OUTPUT_DIR, name);
    await sharp(SOURCE_IMAGE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`✅ ${name} (${size}x${size}) 생성 완료`);
  }

  // favicon.ico 생성 (16x16, 32x32 포함)
  // sharp는 ico 직접 생성 불가, 대신 32x32 PNG를 ico로 복사
  const icoPath = path.join(OUTPUT_DIR, 'favicon.ico');
  await sharp(SOURCE_IMAGE)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(icoPath.replace('.ico', '_temp.png'));

  // PNG를 ICO로 변환 (간단한 방법: PNG 그대로 사용, 대부분의 브라우저 지원)
  const pngBuffer = await sharp(SOURCE_IMAGE)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();

  fs.writeFileSync(icoPath, pngBuffer);
  fs.unlinkSync(icoPath.replace('.ico', '_temp.png'));
  console.log(`✅ favicon.ico (32x32) 생성 완료`);

  // 로고 이미지도 복사 (OG 이미지용)
  const logoPath = path.join(OUTPUT_DIR, 'FACTOR_LOGO_NEW.png');
  await sharp(SOURCE_IMAGE)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(logoPath);
  console.log(`✅ FACTOR_LOGO_NEW.png (512x512) 생성 완료`);

  console.log('\n🎉 모든 파비콘 생성 완료!');
}

generateFavicons().catch(console.error);
