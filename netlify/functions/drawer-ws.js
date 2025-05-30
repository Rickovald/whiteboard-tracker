// Заглушка для WebSocket функции
// Netlify Functions не поддерживают WebSocket напрямую
// Для WebSocket нужно использовать Netlify Edge Functions или внешний сервис

exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "WebSocket не поддерживается в Netlify Functions. Используйте внешний сервис для WebSocket."
    })
  };
};