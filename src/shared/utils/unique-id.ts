// export const uniqueId = (length = 10): string => {
//   const result = [];
//   const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//   const cl = characters.length;

//   for (let i = 0; i < length; i++) {
//     result.push(characters.charAt(Math.floor(Math.random() * cl)));
//   }

//   return result.join('');
// }

export const uniqueId = (length = 10): string => {
  return [...Array(length)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
}
