// Integer arithmetic keeps the rounding rule for estimated rods predictable.
const SCALE=BigInt(1000);
export function parseThousandths(value:string):bigint | null {
  if(!/^\d{1,12}(?:\.\d{1,3})?$/.test(value)) return null;
  const [whole,fraction=""]=value.split(".");
  return BigInt(whole)*SCALE+BigInt(fraction.padEnd(3,"0"));
}
function decimal(value:bigint):string {
  const whole=value/SCALE, fractional=(value%SCALE).toString().padStart(3,"0").replace(/0+$/,"");
  return fractional ? `${whole},${fractional}` : whole.toString();
}
function roundedDivide(n:bigint,d:bigint):bigint { return (n+d/BigInt(2))/d; }
export function glueForFeathers(feathers:string,gramsPerFeather:string,gramsPerPot:string) {
  const count=parseThousandths(feathers), perFeather=parseThousandths(gramsPerFeather), perPot=parseThousandths(gramsPerPot);
  if(count===null || count%SCALE!==BigInt(0) || perFeather===null || perFeather<=BigInt(0) || perPot===null || perPot<=BigInt(0)) return null;
  const grams=count/SCALE*perFeather;
  return {grams:decimal(grams),pots:decimal(roundedDivide(grams*SCALE,perPot))};
}
export function rodsForWeight(kg:string,rodsPerKg:string,gramsPerRod?:string) {
  const weight=parseThousandths(kg), rate=parseThousandths(rodsPerKg);
  if(weight===null || rate===null || rate<=BigInt(0)) return null;
  if(gramsPerRod) {
    const grams=parseThousandths(gramsPerRod);
    if(grams===null || grams<=BigInt(0)) return null;
    return (weight*SCALE/grams).toString();
  }
  return (weight*rate/(SCALE*SCALE)).toString();
}
export function fiberglassSegments(rods:string,segmentsPerRod:string) {
  const count=parseThousandths(rods), rate=parseThousandths(segmentsPerRod);
  if(count===null || rate===null || count%SCALE!==BigInt(0) || rate%SCALE!==BigInt(0) || rate<=BigInt(0)) return null;
  return (count/SCALE*(rate/SCALE)).toString();
}
