import { DiatonicInterval } from "./diatonic";

// 音乐中通常极少涉及大于23的因子，且部分因子最“自然”的映射不明确，因此程序中仅处理23以内的因子，节省性能。
const PRIME_MAPPINGS = [
    {prime:  2, map: {steps:  7, fifths:  0}},
    {prime:  3, map: {steps: 11, fifths:  1}},
    {prime:  5, map: {steps: 16, fifths:  4}},
    {prime:  7, map: {steps: 20, fifths: -2}},
    {prime: 11, map: {steps: 24, fifths: -1}},
    {prime: 13, map: {steps: 26, fifths: -4}},
    {prime: 17, map: {steps: 29, fifths: -5}},
    {prime: 19, map: {steps: 30, fifths: -3}},
    {prime: 23, map: {steps: 31, fifths:  6}},
] as const;

function gcd(a: number, b: number): number {
    if (a < 0) a = -a;
    if (b < 0) b = -b;
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}

export class Ratio {
    readonly num: number;
    readonly den: number;

    constructor(num: number, den: number = 1) {
        this.num = num;
        this.den = den;
        if (this.den < 0) {
            this.num = -this.num;
            this.den = -this.den;
        }
        const g = gcd(this.num, this.den);
        if (g !== 0) {
            this.num /= g;
            this.den /= g;
        }
    }

    toString(): string {
        return `${this.num}/${this.den}`;
    }

    multiply(other: number | Ratio): Ratio {
        if (typeof other === "number") {
            other = new Ratio(other);
        }
        return new Ratio(this.num * other.num, this.den * other.den);
    }

    divide(other: number | Ratio): Ratio {
        if (typeof other === "number") {
            other = new Ratio(other);
        }
        return new Ratio(this.num * other.den, this.den * other.num);
    }

    static readonly ZERO = new Ratio(0, 1);
    static readonly ONE = new Ratio(1, 1);
    static readonly INF = new Ratio(1, 0);
    static readonly NAN = new Ratio(0, 0);
}

interface FjsInterval extends DiatonicInterval {
    highPrimes: Ratio;
}

export function parseRatio(r: Ratio): FjsInterval | null {
    let {num, den} = r;
    const ans = {steps: 0, fifths: 0, highPrimes: Ratio.ONE};
    for (const {prime, map} of PRIME_MAPPINGS) {
        while (num % prime === 0) {
            num /= prime;
            ans.steps += map.steps;
            ans.fifths += map.fifths;
            if (prime > 3) ans.highPrimes = ans.highPrimes.multiply(prime);
        }
        while (den % prime === 0) {
            den /= prime;
            ans.steps -= map.steps;
            ans.fifths -= map.fifths;
            if (prime > 3) ans.highPrimes = ans.highPrimes.divide(prime);
        }
        if (num === 1 && den === 1) return ans;
    }
    return null;
}