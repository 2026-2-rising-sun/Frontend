// Payment 추가 시 기존 Live·Notification 포트가 밀리지 않도록 서비스별로 고정한다.
export const servicePorts = { member: 8081, catalog: 8082, commercecore: 8083, live: 8084, notification: 8085, payment: 8086 }
// 결제·환불은 CommerceCore facade를 사용하며 Payment 내부 API는 브라우저에 노출하지 않는다.
export const publicServices = Object.keys(servicePorts).filter(service => service !== 'payment')
