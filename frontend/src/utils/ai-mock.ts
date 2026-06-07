export function getAIMockResponse(question: string, docName?: string): string {
  const q = question.toLowerCase()
  if (q.includes("tÃ³m táº¯t") || q.includes("summary")) {
    return `ðŸ“ **TÃ³m táº¯t ${docName ? `"${docName}"` : "tÃ i liá»‡u"}:**\n\nTÃ i liá»‡u nÃ y bao gá»“m cÃ¡c ná»™i dung chÃ­nh:\n\n1. **Pháº§n má»Ÿ Ä‘áº§u** â€” Giá»›i thiá»‡u tá»•ng quan vá» chá»§ Ä‘á».\n2. **Ná»™i dung chÃ­nh** â€” PhÃ¢n tÃ­ch chi tiáº¿t vá»›i vÃ­ dá»¥ minh há»a.\n3. **á»¨ng dá»¥ng** â€” CÃ¡ch Ã¡p dá»¥ng kiáº¿n thá»©c vÃ o thá»±c tiá»…n.\n4. **Káº¿t luáº­n** â€” Tá»•ng há»£p Ä‘iá»ƒm máº¥u chá»‘t.\n\nBáº¡n muá»‘n tÃ´i giáº£i thÃ­ch sÃ¢u hÆ¡n pháº§n nÃ o?`
  }
  return `ðŸ¤– **PhÃ¢n tÃ­ch cÃ¢u há»i cá»§a báº¡n:**\n\n"${question.slice(0, 60)}${question.length > 60 ? "..." : ""}"\n\nDá»±a trÃªn ${docName ? `tÃ i liá»‡u **"${docName}"**` : "há»‡ thá»‘ng kiáº¿n thá»©c"}:\n\n1. **PhÃ¢n tÃ­ch váº¥n Ä‘á»**: Cáº§n xem xÃ©t cÃ¡c yáº¿u tá»‘ áº£nh hÆ°á»Ÿng\n2. **HÆ°á»›ng tiáº¿p cáº­n**: Ãp dá»¥ng phÆ°Æ¡ng phÃ¡p tá»« Ä‘Æ¡n giáº£n Ä‘áº¿n phá»©c táº¡p\n3. **Káº¿t quáº£ mong Ä‘á»£i**: Hiá»ƒu rÃµ váº¥n Ä‘á» vÃ  Ã¡p dá»¥ng thá»±c táº¿\n\nðŸ’¡ *Tip: Upload tÃ i liá»‡u cá»¥ thá»ƒ Ä‘á»ƒ tÃ´i tráº£ lá»i chÃ­nh xÃ¡c hÆ¡n!*`
}

