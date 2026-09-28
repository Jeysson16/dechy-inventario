const ONES = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

export function toWords(n) {
  if (n < 0) return "menos " + toWords(-n);
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  if (n < 20) return ONES[n];
  if (n < 30) return n === 20 ? "veinte" : "veinti" + ONES[n - 20];
  if (n < 100)
    return TENS[Math.floor(n / 10)] + (n % 10 ? " y " + ONES[n % 10] : "");
  if (n < 1000)
    return (
      HUNDREDS[Math.floor(n / 100)] + (n % 100 ? " " + toWords(n % 100) : "")
    );
  if (n === 1000) return "mil";
  if (n < 2000) return "mil " + toWords(n % 1000);
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    return toWords(miles) + " mil" + (resto ? " " + toWords(resto) : "");
  }
  return n.toString();
}

export function amountInWords(amount, currencyLabel = "SOLES") {
  const fixed = parseFloat(amount || 0).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  return (
    "SON: " +
    toWords(parseInt(intPart, 10)).toUpperCase() +
    " CON " +
    decPart +
    `/100 ${currencyLabel}`
  );
}
