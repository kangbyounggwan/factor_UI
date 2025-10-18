// 브라우저 개발자 도구 콘솔에서 실행하세요
console.log('=== Dashboard 캐시 데이터 확인 ===');
const keys = Object.keys(localStorage).filter(k => k.includes('dashboard') || k.includes('printer'));
console.log('캐시 키:', keys);
keys.forEach(key => {
  const data = localStorage.getItem(key);
  console.log(`\n${key}:`, data);
});

console.log('\n=== 캐시 삭제 (실행하려면 주석 해제) ===');
// keys.forEach(key => localStorage.removeItem(key));
// console.log('캐시가 삭제되었습니다. 페이지를 새로고침하세요.');
