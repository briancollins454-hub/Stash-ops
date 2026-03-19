export function standardizeSize(size: string) {
  if (!size) {
    return "";
  }

  const key = size.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    s: "S",
    small: "S",
    m: "M",
    medium: "M",
    l: "L",
    large: "L",
    xl: "XL",
    xlarge: "XL",
    xxl: "2XL",
    "2xl": "2XL",
    xxxl: "3XL",
    "3xl": "3XL",
    "4xl": "4XL",
    xs: "XS",
    xsmall: "XS",
    one: "ONE",
    onesize: "ONE",
  };

  return map[key] ?? size.toUpperCase();
}

export function isEligibleForMapping(itemName: string, productType?: string) {
  const name = itemName.toLowerCase();
  const type = (productType ?? "").toLowerCase();

  if (type.includes("service")) {
    return false;
  }

  const exclusions = [
    "add name",
    "add initials",
    "personalisation",
    "personalization",
    "customisation",
    "customization",
    "printing service",
    "embroidery service",
  ];

  return !exclusions.some((entry) => name.includes(entry));
}

export function extractDecoJobNumberCandidate(text?: string) {
  if (!text) {
    return undefined;
  }

  const match = text.match(/(?:^|[^0-9])(2\d{5})(?![0-9])/);
  return match ? match[1] : undefined;
}
