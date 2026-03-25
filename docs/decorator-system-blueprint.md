# Stash Decorator System — Full Implementation Blueprint

## 1. System Definition

The Stash Decorator is a production-aware design placement and customisation engine for branded clothing, workwear, promotional items, and teamwear. It operates across three contexts:

- **Internal staff use** — operators configure decoration on jobs, build proofs, set up production specs
- **Customer-facing storefront** — end customers customise products within controlled boundaries
- **Account/campaign mode** — pre-configured products with locked branding and editable personalisation fields

It is not a generic image editor. Every operation produces data that feeds directly into quoting, proofing, approval, and production workflows. The canvas enforces real-world constraints: physical print areas, method-specific limits, minimum DPI, maximum stitch counts, colour palette restrictions, and garment-specific zone geometry.

The system replaces both the existing `designer-modal.tsx` (quote-level artwork placement) and `decorator-studio.tsx` (template proof-of-concept) with a unified decorator that covers all use cases.

---

## 2. Complete Feature Breakdown

### 2.1 Designer Canvas

| Feature | Detail |
|---------|--------|
| **Canvas rendering** | HTML5 Canvas (Fabric.js or Konva.js) with WebGL acceleration for complex scenes |
| **Object types** | Text, raster image, vector (SVG), shape (rect/circle/line), group, template region |
| **Selection** | Click-select, multi-select (shift+click, marquee drag), select-all |
| **Transform** | Move (drag), resize (8 handles + edge), rotate (handle + numeric), scale (uniform + free) |
| **Snapping** | Centre-line snap, edge snap, grid snap (configurable granularity) |
| **Alignment** | Align left/centre/right/top/middle/bottom, distribute horizontally/vertically |
| **Layer ordering** | Bring forward, send backward, bring to front, send to back |
| **Undo/redo** | Full action stack with ctrl+Z / ctrl+shift+Z, minimum 50 steps |
| **Zoom/pan** | Scroll-wheel zoom (25%-400%), click-drag pan, fit-to-view, actual-size |
| **Rulers** | Optional mm/inch rulers on canvas edges with zone dimension markers |
| **Clipboard** | Cut, copy, paste, duplicate (ctrl+C/V/D) |
| **Delete** | Delete key removes selected objects |
| **Keyboard shortcuts** | Arrow keys nudge 1px (shift+arrow = 10px), escape deselects |
| **Touch support** | Pinch zoom, two-finger pan, long-press select for tablets |

### 2.2 Product Views and Decoration Positions

| Feature | Detail |
|---------|--------|
| **Multi-view products** | Front, Back, Left Side, Right Side, plus custom views (Hood, Collar, Pocket, Cuff, Hem) |
| **View images** | Colour-specific product photos per view, sourced from Deco view images, supplier CDN, or uploaded |
| **SVG silhouettes** | Fallback garment outlines when no photo exists, filled with selected colour |
| **Decoration zones** | Named, positioned rectangles on each view representing physical print areas |
| **Zone geometry** | Position (x%, y%), size (w%, h%), actual dimensions in mm, rotation, custom shapes via SVG clip path |
| **Zone restrictions** | Max print size, allowed decoration methods, max colours, min/max DPI per method |
| **Zone grouping** | Zones can be grouped (e.g. "Left Chest" zone is on "Front" view) |
| **Visual indicators** | Dashed boundary for active zone, subtle markers for inactive zones, green dot for configured zones |
| **Product types** | T-shirt, polo, hoodie, jacket, fleece, gilet, trousers, shorts, cap, beanie, bag, hi-vis, apron, towel, mug, pen, umbrella, lanyard, bottle — each with sensible default zones |

### 2.3 Text Editing

| Feature | Detail |
|---------|--------|
| **Add text** | Click "Add Text" to create a new text object in the active zone |
| **Inline editing** | Double-click text to enter edit mode, type directly on canvas |
| **Font selection** | Dropdown of available fonts, loaded from admin-managed font library |
| **Font size** | Numeric input in points, with canvas-relative preview |
| **Font style** | Bold, italic, underline, strikethrough toggles |
| **Text alignment** | Left, centre, right, justify |
| **Line spacing** | Leading control (0.8× to 3×) |
| **Letter spacing** | Tracking control (-50 to +200) |
| **Text colour** | Colour picker with PMS/Pantone input, thread colour library for embroidery |
| **Text outline** | Stroke colour + width for outlined text |
| **Text shadow** | Drop shadow with X/Y offset, blur, colour |
| **Curved text** | Arc text with radius control for cap brims, circular logos |
| **Multi-line** | Full paragraph support with word wrap within zone bounds |
| **Text-to-path** | Convert text to vector outlines (for production export) |
| **Character limit** | Admin-configurable per zone/template |
| **Font subsetting** | Only load glyphs needed for the current design (performance) |

### 2.4 Artwork Upload and Editing

| Feature | Detail |
|---------|--------|
| **Upload methods** | Drag-and-drop onto canvas, file picker button, paste from clipboard |
| **File formats** | PNG, JPG, WEBP, SVG, PDF, EPS, AI, CDR, DST, PES, JEF, EXP, VP3, HUS, EMB |
| **Size limit** | 50 MB per file (configurable) |
| **Auto-conversion** | Server-side conversion of EPS/AI/PDF/CDR to SVG + PNG preview via headless Inkscape/Ghostscript |
| **Embroidery files** | DST/PES/JEF render as stitch preview (via server-side stitch renderer) |
| **Background removal** | One-click server-side background removal (rembg or remove.bg API) |
| **Image cropping** | Rectangular crop tool with aspect ratio lock |
| **Brightness/contrast** | Slider adjustments applied as CSS filters (preview) and ImageMagick (export) |
| **Colour replacement** | Pick a colour in the image → replace with another (raster) or change fill (SVG) |
| **SVG recolouring** | Parse SVG fill/stroke attributes, present each unique colour as editable swatch |
| **Transparency** | Opacity slider (0-100%) per object |
| **Clipping** | Artwork auto-clipped to zone boundary, with visual overflow indicator |
| **DPI indicator** | Show effective DPI at current size; warn if below method minimum (e.g. <150 for DTG, <300 for screen print) |
| **Original file retention** | Store original uploaded file separately from preview/converted version |

### 2.5 Templates and Reusable Designs

| Feature | Detail |
|---------|--------|
| **Template definition** | A saved arrangement of objects (text, artwork, shapes) within a product's zones |
| **Template regions** | Each object in a template is marked as: locked, editable, replaceable, or hidden |
| **Locked regions** | Cannot be moved, resized, deleted, or edited by customers (brand logos, compliance marks) |
| **Editable regions** | Customer can change text content but not position/size/font (name fields, department text) |
| **Replaceable regions** | Customer can swap artwork but not change position/size (team crest slot) |
| **Hidden regions** | Not visible to customers but included in production output (internal marks, colour references) |
| **Template scoping** | Global (all accounts), account-level, or campaign-level |
| **Template versioning** | Version number increments on save; previous versions archived |
| **Template preview** | Auto-generated thumbnail showing the template applied to a default product/colour |
| **Pre-decorated products** | Template + product = sellable pre-decorated SKU with its own pricing |
| **Template categories** | Organised by type: school leavers, workwear, sports, events, corporate |

### 2.6 Personalisation and Names/Numbers

| Feature | Detail |
|---------|--------|
| **Personalisation fields** | Defined per template or per zone: Name, Number, Initials, Department, Year, Custom |
| **Field constraints** | Max length, allowed characters (alpha/numeric/both), required/optional, default value |
| **Single-item personalisation** | Customer fills in fields for their own item during customisation |
| **Bulk personalisation** | Upload CSV/Excel with columns mapped to personalisation fields |
| **CSV mapping** | Column header auto-match + manual override for Name, Number, Size, Colour |
| **Bulk validation** | Per-row validation: character limits, required fields, valid sizes, valid colours |
| **Names/numbers grid** | Inline editable table for manual entry of names/numbers per size |
| **Team roster** | Save roster to account for reuse across orders |
| **Live preview per row** | Click a row in the bulk table to see that person's garment preview |
| **Personalisation pricing** | Per-field or per-item surcharge, configurable by decoration method |
| **Split production** | System auto-splits personalised items into individual production units |

### 2.7 Decoration Method Support

Each method has specific rules the decorator enforces:

| Method | Code | Colour Model | Max Colours | Min Size | Max Size | DPI Min | Special Rules |
|--------|------|-------------|-------------|----------|----------|---------|---------------|
| **Embroidery** | WEMB | Thread palette | 15 | 10×10 mm | 350×350 mm | N/A | Stitch count calc, no gradients, min 1mm line width, running/satin/fill types |
| **DTG** | DTG | CMYK+W | Unlimited | 10×10 mm | 420×594 mm | 150 | White underbase on dark garments, no metallic |
| **DTF** | DTF | CMYK+W | Unlimited | 10×10 mm | 600×900 mm | 200 | Gang sheet optimisation, white underbase auto |
| **Screen Print** | RHS | PMS/Spot | 8 | 20×20 mm | 500×700 mm | 300 | Per-colour separation, halftone option, mesh count |
| **Transfer** | TRF | CMYK | Unlimited | 10×10 mm | 400×500 mm | 200 | Mirror flag for heat press |
| **Sublimation** | SUB | CMYK | Unlimited | Full garment | Full garment | 200 | Polyester only, white/light base only |
| **Vinyl/Flex** | VNL | Spot | 3 | 5×5 mm | 500×700 mm | N/A | Vector only, no fine detail <2mm, weeding paths |
| **UV Print** | UVP | CMYK+W | Unlimited | 5×5 mm | 300×300 mm | 300 | Hard goods only |

### 2.8 Proof Generation and Approval

| Feature | Detail |
|---------|--------|
| **Proof render** | Server-side render of design on product image at 300 DPI, PDF or PNG |
| **Proof PDF** | Multi-page: cover (product + design), per-view mockup, specification sheet (dimensions, colours, method, placement), personalisation summary |
| **Proof versioning** | v1, v2, v3... each stored and diffable |
| **Proof delivery** | Email to customer with approve/reject links, or in-app approval for internal |
| **Approval workflow** | Customer reviews → approves or rejects with comments → staff revises → re-proof |
| **Approval status** | Pending, Approved, Rejected, Changes Requested, Auto-approved |
| **Auto-approval** | Configurable: repeat orders from approved templates skip approval |
| **Proof watermark** | "PROOF — NOT FOR PRODUCTION" overlay on customer-facing previews |
| **Change annotations** | Customer can mark up proof with comments tied to specific positions |

### 2.9 Pricing Logic

| Feature | Detail |
|---------|--------|
| **Base product price** | From Deco catalog or manual entry, per size/colour |
| **Decoration charge** | Per-method pricing: setup fee + per-unit fee |
| **Embroidery pricing** | Setup + per-1000-stitches rate × stitch count |
| **Screen print pricing** | Setup per colour + per-unit per colour, with quantity breaks |
| **DTG/DTF pricing** | Setup + per-unit by size bracket (A5/A4/A3/oversized) |
| **Transfer pricing** | Setup + per-unit fixed |
| **Personalisation surcharge** | Per-item for names/numbers, per-field for custom text |
| **Quantity breaks** | Tiered unit pricing: 1-24, 25-49, 50-99, 100-249, 250-499, 500+ |
| **Multi-position pricing** | Additional decoration positions charged separately |
| **Minimum order value** | Per-method minimum (e.g. screen print min 25 units) |
| **Margin rules** | Minimum margin % enforced, warnings on low-margin configs |
| **Price preview** | Live price update in decorator as customer changes method/colours/quantity |
| **Discount codes** | Account-level or campaign-level percentage/fixed discounts |

### 2.10 Artwork Library

| Feature | Detail |
|---------|--------|
| **Global library** | Admin-managed artwork available to all users (stock designs, icons, backgrounds) |
| **Account library** | Per-account artwork: logos, crests, brand assets uploaded by staff or customer |
| **Design library** | Saved complete designs (template + artwork + settings) reusable across orders |
| **Categories/tags** | Artwork organised by category (logos, backgrounds, icons, sport, school) and searchable by tag |
| **Favourites** | Users can star frequently used artwork |
| **Usage tracking** | Track which artwork is used in which jobs for licensing/audit |
| **Version control** | Upload new version of an artwork, old version archived, active jobs using old version flagged |
| **File metadata** | Original filename, upload date, uploader, dimensions, file size, colour count, DPI |
| **Thumbnail generation** | Auto-generated thumbnails for library browsing |
| **Access control** | Artwork visibility: public (storefront), internal (staff only), account-specific |

### 2.11 Admin Controls

| Feature | Detail |
|---------|--------|
| **Font management** | Upload TTF/OTF/WOFF2, set display name, assign to categories, enable/disable |
| **Template builder** | Staff-only decorator mode with template region controls (lock/edit/replace/hide) |
| **Zone editor** | Define/edit decoration zones per product or product category, set dimensions, methods, restrictions |
| **Method configuration** | Enable/disable methods, set pricing rules, min/max sizes, colour limits |
| **Pricing rules** | Quantity break tables, setup fees, per-unit rates, margin minimums |
| **Product setup** | Assign views, zones, default templates, allowed methods per product |
| **Artwork moderation** | Review customer-uploaded artwork before production |
| **Design approval** | Staff review and approve/reject customer designs |
| **Global settings** | Default font, default method, upload size limits, DPI thresholds, watermark text |
| **Store settings** | Per-storefront: which methods available, which fonts, which artwork library visible |
| **User permissions** | Role-based: admin (full), operator (configure jobs), designer (templates only), customer (restricted) |

### 2.12 Production Outputs

| Feature | Detail |
|---------|--------|
| **Production spec sheet** | Per-item: product, colour, size, placement, method, dimensions (mm), colours (PMS), stitch count, notes |
| **Print-ready artwork** | Exported at correct DPI for method, colour-separated if screen print, mirrored if transfer |
| **Embroidery file export** | Convert design to DST/PES via stitch engine or flag for manual digitising |
| **Gang sheet layout** | DTF: auto-arrange multiple designs on transfer sheet for production efficiency |
| **Cut file export** | Vinyl: SVG/DXF with cut paths and weeding lines |
| **Personalisation manifest** | CSV/PDF listing every name/number with corresponding size/colour |
| **Proof PDF** | Customer-facing proof document |
| **Job ticket** | Internal production ticket with all specs, artwork, and instructions |
| **Barcode labels** | Per-unit labels with job ID, name, size for matching after production |

---

## 3. Major Modules

### Module 1: Canvas Engine (`@stash/canvas`)

The rendering and interaction layer. Wraps Fabric.js with domain-specific behaviours.

**Responsibilities:**
- Render product image/silhouette as background
- Render decoration zone boundaries (dashed rectangles, clip paths)
- Render design objects (text, images, shapes) within zones
- Handle all pointer/touch interaction (select, move, resize, rotate)
- Enforce zone boundaries (clipping, containment warnings)
- Manage object stack (layers, z-ordering)
- Undo/redo action stack
- Serialise/deserialise canvas state to/from JSON
- Export canvas to PNG/SVG at specified DPI

**Key interfaces:**

```typescript
interface CanvasState {
  productView: string;              // "front" | "back" | "left" | "right" | custom
  backgroundImage?: string;         // Product photo URL
  silhouetteSvg?: string;           // Fallback SVG
  garmentColor: string;             // Hex fill for silhouette
  zones: ZoneDefinition[];          // All zones on this view
  objects: DesignObject[];          // All placed design objects
  activeZoneId?: string;            // Currently selected zone
  selectedObjectIds: string[];      // Currently selected objects
}

interface ZoneDefinition {
  id: string;
  key: string;                      // "left_chest", "full_back", etc.
  label: string;                    // "Left Chest"
  view: string;                     // Which product view this zone belongs to
  x: number; y: number;             // Position as % of canvas
  w: number; h: number;             // Size as % of canvas
  actualWidthMm: number;            // Physical width
  actualHeightMm: number;           // Physical height
  rotation: number;                 // Zone rotation in degrees
  clipPath?: string;                // SVG path for non-rectangular zones
  allowedMethods: string[];         // ["WEMB", "DTG", "DTF"]
  maxColors: number;
  minDpi: number;
  isRequired: boolean;              // Must have design before approval
}

interface DesignObject {
  id: string;
  zoneId: string;                   // Which zone this belongs to
  type: "text" | "image" | "svg" | "shape" | "group";
  // Position relative to zone (0-100%)
  x: number; y: number;
  w: number; h: number;
  rotation: number;
  opacity: number;
  flipH: boolean; flipV: boolean;
  locked: boolean;                  // Cannot be transformed
  editable: boolean;                // Content can be changed
  replaceable: boolean;             // Image can be swapped
  visible: boolean;
  // Type-specific data
  textData?: TextObjectData;
  imageData?: ImageObjectData;
  svgData?: SvgObjectData;
  shapeData?: ShapeObjectData;
}

interface TextObjectData {
  content: string;
  fontFamily: string;
  fontSize: number;                 // Points
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  underline: boolean;
  strikethrough: boolean;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;               // Multiplier
  letterSpacing: number;            // px
  fill: string;                     // Hex colour
  stroke?: string;                  // Outline colour
  strokeWidth?: number;
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
  curve?: { radius: number; };      // Arc text
  maxChars?: number;
  personalisationField?: string;    // "name" | "number" | "initials" | "department" | "year" | custom
}

interface ImageObjectData {
  originalFileId: string;           // Reference to stored file
  originalUrl: string;              // URL to original upload
  previewUrl: string;               // Rendered preview (converted if needed)
  sourceType: "upload" | "library" | "account";
  filename: string;
  fileType: string;                 // "png" | "svg" | "eps" | "dst" etc.
  naturalWidth: number;
  naturalHeight: number;
  effectiveDpi: number;             // Calculated from render size vs natural size
  filters?: {
    brightness?: number;            // -100 to 100
    contrast?: number;
    backgroundRemoved?: boolean;
  };
}

interface SvgObjectData {
  svgContent: string;               // Raw SVG markup
  colorMap: Record<string, string>; // Original colour → current colour mapping
  originalFileId: string;
}
```

### Module 2: Product Configuration (`@stash/product-config`)

Manages product views, zones, and method rules.

**Responsibilities:**
- Load product data (views, images, zones) from backend
- Provide zone templates per product type (defaults) and per specific product (overrides)
- Validate design placement against method rules
- Calculate effective DPI for placed artwork
- Determine which methods are available for a given product + zone

**Data flow:**

```
Product selected
  → Fetch product detail (Deco API + catalog images)
  → Determine product type (hoodie/tshirt/cap/bag/...)
  → Load zone template (default for type OR product-specific override)
  → Load available views from product images
  → For each view, resolve: background image, silhouette SVG, zones
  → Present to canvas engine
```

### Module 3: Design Manager (`@stash/design-manager`)

Handles the full lifecycle of a design from creation to production output.

**Responsibilities:**
- Create, save, load, version designs
- Serialise canvas state to `Design` entity
- Associate designs with jobs, quotes, accounts, templates
- Handle personalisation field bindings
- Generate previews (thumbnails, proofs)
- Export production-ready files
- Track design approval status

**Key entity:**

```typescript
interface Design {
  id: string;
  version: number;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "production_ready";
  
  // Ownership
  accountId?: string;
  jobId?: string;
  jobItemId?: string;
  templateId?: string;
  createdBy: string;                // User ID
  
  // Product binding
  productCode: string;
  productName: string;
  colorId?: number;
  colorName?: string;
  
  // Canvas data — one per view
  views: Record<string, CanvasState>;
  
  // Decoration specs (derived from canvas objects)
  placements: DesignPlacement[];
  
  // Personalisation
  personalisationFields: PersonalisationField[];
  personalisationData?: PersonalisationRow[];   // Filled for bulk orders
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  proofUrl?: string;
  proofVersion?: number;
  notes?: string;
}

interface DesignPlacement {
  zoneId: string;
  zoneKey: string;
  zoneLabel: string;
  view: string;
  decorationMethod: string;
  widthMm: number;
  heightMm: number;
  colorCount: number;
  colors: string[];                 // PMS codes or thread names
  stitchCount?: number;             // Embroidery
  objectCount: number;
  hasPersonalisation: boolean;
  productionNotes: string;
}

interface PersonalisationField {
  id: string;
  key: string;                      // "name" | "number" | "initials" | custom
  label: string;                    // "Player Name"
  type: "text" | "number";
  maxLength: number;
  required: boolean;
  defaultValue?: string;
  allowedChars?: string;            // Regex pattern
  linkedObjectId: string;           // Which DesignObject this binds to
  linkedZoneId: string;
}

interface PersonalisationRow {
  rowIndex: number;
  fields: Record<string, string>;   // field key → value
  sizeCode: string;
  colorName?: string;
  quantity: number;
}
```

### Module 4: Artwork Service (`@stash/artwork-service`)

Server-side file processing, storage, and library management.

**Responsibilities:**
- Accept file uploads (presigned URL to S3/R2)
- Convert vector files (EPS/AI/PDF/CDR → SVG + PNG)
- Convert embroidery files (DST/PES → stitch preview PNG)
- Background removal (rembg)
- Image manipulation (crop, resize, colour adjustment)
- Colour extraction from raster images
- SVG colour parsing for recolouring
- DPI analysis
- Thumbnail generation
- File storage management (S3/Cloudflare R2)
- Artwork library CRUD (global, account, campaign)
- Artwork versioning
- Virus/malware scanning on upload

**API endpoints:**

```
POST   /api/v1/artwork/upload          → Presigned upload URL + file ID
POST   /api/v1/artwork/:id/convert     → Trigger conversion pipeline
POST   /api/v1/artwork/:id/remove-bg   → Background removal
GET    /api/v1/artwork/:id             → File metadata + URLs
DELETE /api/v1/artwork/:id             → Soft delete

GET    /api/v1/artwork-library                        → Browse global library
GET    /api/v1/artwork-library/account/:accountId     → Account artwork
POST   /api/v1/artwork-library                        → Add to library
PUT    /api/v1/artwork-library/:id                    → Update metadata/tags
DELETE /api/v1/artwork-library/:id                    → Remove from library
```

### Module 5: Template Engine (`@stash/templates`)

Creation, management, and application of reusable design templates.

**Responsibilities:**
- Template CRUD with versioning
- Template regions (locked/editable/replaceable/hidden)
- Apply template to product → creates a new Design with template objects pre-placed
- Pre-decorated product generation (template + product = new sellable SKU)
- Template scoping (global, account, campaign)
- Template preview generation

**Key entity:**

```typescript
interface DesignTemplate {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;                  // "school-leavers" | "workwear" | "sports" | "corporate" | "events"
  scope: "global" | "account" | "campaign";
  accountId?: string;
  campaignId?: string;
  
  // What products this template applies to
  productType: string;               // "hoodie" | "tshirt" | etc.
  productCodes?: string[];           // Specific product codes, or null for any of that type
  
  // Template canvas data
  views: Record<string, TemplateCanvasState>;
  
  // Per-object editability
  objectPermissions: Record<string, {
    locked: boolean;
    editable: boolean;
    replaceable: boolean;
    hidden: boolean;
  }>;
  
  // Personalisation field definitions
  personalisationFields: PersonalisationField[];
  
  // Default decoration settings
  defaultMethods: Record<string, string>;  // zoneKey → method code
  
  // Preview
  thumbnailUrl: string;
  previewUrls: Record<string, string>;     // view → preview image
  
  // Pricing
  decorationSurcharge?: number;            // Additional cost for this template's decoration
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
}
```

### Module 6: Pricing Engine (`@stash/pricing`)

Real-time decoration pricing based on method, size, colours, quantity, and personalisation.

**Responsibilities:**
- Calculate decoration cost per placement
- Apply quantity breaks
- Calculate personalisation surcharges
- Enforce minimum order quantities/values
- Calculate total quote/order price
- Provide live price preview in decorator
- Margin calculation and warnings

**Key entity:**

```typescript
interface DecorationPriceRule {
  id: string;
  method: string;                    // "WEMB" | "DTG" | "DTF" | "RHS" | "TRF" | "SUB" | "VNL"
  name: string;                     // "Embroidery Standard"
  
  setupFee: number;                  // One-time setup in pence
  perUnitBase: number;               // Base per-unit in pence
  
  // Method-specific pricing inputs
  perThousandStitches?: number;      // Embroidery: pence per 1000 stitches
  perColor?: number;                 // Screen print: pence per colour per unit
  perColorSetup?: number;            // Screen print: setup per colour
  sizeBrackets?: {                   // DTG/DTF: price by print size
    label: string;                   // "A5" | "A4" | "A3" | "Oversized"
    maxWidthMm: number;
    maxHeightMm: number;
    perUnit: number;                 // pence
  }[];
  
  // Quantity breaks
  quantityBreaks: {
    minQty: number;
    maxQty: number;
    perUnit: number;                 // Override per-unit price at this tier
    setupFee?: number;               // Override setup at this tier
  }[];
  
  // Personalisation
  personalisationPerItem: number;    // Surcharge per personalised item
  personalisationPerField: number;   // Surcharge per additional field
  
  // Constraints
  minimumQuantity: number;
  minimumOrderValue: number;         // pence
  
  isActive: boolean;
}

interface PriceCalculation {
  productUnitPrice: number;          // From catalog/manual
  decorationCharges: {
    zoneKey: string;
    method: string;
    setupFee: number;
    perUnitRate: number;
    perUnitTotal: number;            // rate × quantity
    breakdown: string;               // Human-readable: "3,200 stitches × £0.008/stitch = £25.60"
  }[];
  personalisationCharge: number;
  subtotalPerUnit: number;
  quantity: number;
  totalBeforeDiscount: number;
  discount: number;
  total: number;
  marginPercent: number;
  warnings: string[];                // Low margin, below minimum, etc.
}
```

### Module 7: Proof & Approval (`@stash/proofing`)

Generates proofs and manages the approval workflow.

**Responsibilities:**
- Render design onto product image at print resolution
- Generate multi-page proof PDF
- Version and store proofs
- Send proof to customer (email with magic link)
- Receive approval/rejection
- Track approval status
- Handle re-proof cycle
- Auto-approval rules for repeat/templated orders

**Proof PDF structure:**

```
Page 1: Cover
  - Company logo, job reference, date, customer name
  - "PROOF — FOR APPROVAL"

Page 2-N: Product Views
  - One page per view with design shown on product mockup
  - Colour swatch bar showing garment colour
  - Zone labels annotated

Page N+1: Specification Sheet
  - Table: Zone | Method | Size (mm) | Colours | Stitch Count | Notes
  - Font list used
  - PMS colour references with swatches
  - Total decoration positions

Page N+2: Personalisation Summary (if applicable)
  - Table: Name | Number | Size | Colour
  - Total personalised items count

Page N+3: Terms
  - "By approving this proof you confirm..."
  - Approval instructions
```

### Module 8: Personalisation Manager (`@stash/personalisation`)

Handles individual and bulk name/number/custom-field personalisation.

**Responsibilities:**
- Define personalisation fields per template or per design
- Single-item field entry UI
- Bulk CSV/Excel upload with column mapping
- Roster management (save/load team lists per account)
- Per-row validation
- Per-row preview generation
- Split personalised orders into individual production items
- Generate personalisation manifests for production

---

## 4. User Experience

### 4.1 Internal Staff — Job Configuration

Staff open the decorator from a job detail page. The product is pre-loaded from the job's line item.

**Flow:**

```
Job detail page → Click "Configure Decoration" on line item
  → Decorator opens full-screen or large modal
  → Product images loaded (colour-matched to selected colour)
  → Zones shown based on product type
  → Staff selects zone → chooses method → uploads/selects artwork or adds text
  → Positions and sizes design within zone
  → Sets colours (PMS codes, thread colours)
  → Adds production notes per zone
  → Moves to next zone or next view
  → Reviews all placements in summary panel
  → Clicks "Save" → design stored against job item
  → Clicks "Generate Proof" → proof PDF created and versioned
  → Sends proof to customer for approval
  → Customer approves → design marked production-ready
  → Production spec sheet auto-generated
```

**Staff-specific capabilities:**
- Access all methods, all zones, all artwork
- Override DPI warnings
- Set custom pricing
- Bypass method restrictions (with reason)
- Access template builder mode
- Access account artwork library management
- Bulk-apply designs across multiple line items

### 4.2 Customer — Storefront Customisation

Customer accesses the decorator from the product page on the web storefront.

**Flow:**

```
Product page → Click "Customise" or select pre-decorated product
  → Decorator opens (full page on mobile, modal on desktop)
  → If template applied: locked elements shown, editable fields highlighted
  → Customer can:
    - Add text (within allowed zones)
    - Upload artwork (within allowed zones)
    - Choose from account artwork library
    - Fill in personalisation fields
    - Add names/numbers (single or bulk)
    - Change allowed colours
    - See live price update
  → Add to cart with design attached
  → Design saved to order → flows to job for production
```

**Customer restrictions:**
- Only sees zones/methods enabled for this product
- Cannot access locked template regions
- Artwork uploads moderated (optional)
- Limited font selection (admin-curated subset)
- Cannot override DPI or method warnings
- Price always visible and updated live

### 4.3 Account/Campaign Mode

For uniform orders, school leavers, club kits — pre-configured products with constrained customisation.

**Flow:**

```
Account portal or campaign link → browse pre-decorated products
  → Select product + colour + size
  → If personalisation enabled:
    - Enter name/number/initials
    - Or upload roster CSV for bulk
  → See proof preview
  → Submit order
  → Individual items auto-generated per personalisation row
  → Artwork is from template (already approved) — may skip proof
```

---

## 5. Admin Configuration

### 5.1 Product Zone Management

```
Admin > Products > [Product] > Decoration Zones
  → View current zones on product image
  → Add/edit zones:
    - Name, key, view, position (x/y/w/h %), actual mm dimensions
    - Allowed methods, max colours, min DPI
    - Required flag, default method
  → Product type assignment
  → Category-level defaults (all hoodies get these zones unless overridden)
```

### 5.2 Font Management

```
Admin > Decorator > Fonts
  → Upload font file (TTF/OTF/WOFF2)
  → Set display name, category (serif/sans/script/display)
  → Preview with sample text
  → Enable/disable for customer use
  → Internal-only flag
  → Method restrictions (e.g. embroidery: limit to approved stitch fonts)
```

### 5.3 Template Management

```
Admin > Decorator > Templates
  → List templates with previews
  → Create template:
    - Open decorator in template-builder mode
    - Select product type, place objects, add personalisation fields
    - Mark each object: locked / editable / replaceable / hidden
    - Set default methods per zone
    - Set scope (global, account, campaign)
    - Generate preview
  → Edit template (creates new version)
  → Clone template
  → Archive/deactivate
  → View usage (which jobs used this template)
```

### 5.4 Pricing Rules

```
Admin > Decorator > Pricing
  → Per-method pricing tables:
    - Setup fees
    - Per-unit rates
    - Quantity break tiers
    - Method-specific inputs (stitch rate, colour rate, size brackets)
  → Personalisation pricing
  → Minimum orders
  → Margin rules (warning threshold, enforcement)
```

### 5.5 Artwork Library Management

```
Admin > Decorator > Artwork Library
  → Browse/search all artwork
  → Upload new artwork (with tags, categories)
  → Moderate customer uploads (approve/reject queue)
  → Version management (upload replacement)
  → Usage report per artwork
  → Bulk operations (tag, categorise, archive)
```

### 5.6 Method Configuration

```
Admin > Decorator > Methods
  → Per-method settings:
    - Enabled/disabled
    - Min/max print dimensions
    - Colour limits
    - DPI requirements
    - Special flags (white underbase, mirror, vector-only)
    - Display order in method picker
    - Icon/label customisation
```

---

## 6. Production and Pricing Logic

### 6.1 Production Data Flow

```
Design approved
  → System generates production package:
    1. Job ticket (PDF)
       - Job ref, customer, due date, priority
       - Per-item: product, colour, size, quantity
       - Per-placement: zone, method, dimensions, colours, stitch count
       - Artwork thumbnails inline
       - Personalisation table
    
    2. Print-ready artwork (per placement)
       - Raster at correct DPI for method
       - Colour-separated if screen print
       - Mirrored if transfer
       - Individual files per personalisation variant
    
    3. Personalisation manifest (CSV)
       - Row per item: name, number, size, colour
    
    4. Production queue entry
       - Job item → production_status: QUEUED
       - Method → assigned to appropriate work station
       - Priority calculated from due date + urgency
```

### 6.2 Stitch Count Estimation

For embroidery, the system estimates stitch count from the design:

```
1. Analyse placed artwork within zone
2. For each object:
   - Text: estimate from font metrics × character count × font size × density factor
   - Raster image: pixel area × coverage % × stitches-per-mm² factor (varies by fill type)
   - SVG: filled area × stitches-per-mm² + outline length × stitches-per-mm
3. Sum all objects in zone
4. Apply method overhead factor (jump stitches, border, underlay)
5. Display estimate with ±15% range
6. Staff can override with actual stitch count from digitiser
```

### 6.3 Price Calculation Flow

```
User changes decoration in decorator
  → For each configured zone:
    1. Look up DecorationPriceRule for selected method
    2. Determine per-unit rate:
       - Embroidery: (stitchCount / 1000) × perThousandStitches
       - Screen print: perColor × colorCount
       - DTG/DTF: look up sizeBracket from artwork dimensions
       - Others: perUnitBase
    3. Apply quantity break (find tier for current quantity)
    4. Add setupFee (also with quantity break override option)
    5. Add personalisation surcharge if fields filled
  → Sum all zones = total decoration charge per unit
  → Total per unit = product base price + decoration charge
  → Total order = per unit × quantity - discounts
  → Display in decorator UI with breakdown tooltip
```

---

## 7. Key Entities / Data Structures

### 7.1 Database Schema Additions

```sql
-- Core design storage
CREATE TABLE designs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft, pending_approval, approved, rejected, production_ready
  
  -- Ownership
  account_id      UUID REFERENCES accounts(id),
  job_id          UUID REFERENCES jobs(id),
  job_item_id     UUID REFERENCES job_items(id),
  template_id     UUID REFERENCES design_templates(id),
  created_by      TEXT NOT NULL,
  
  -- Product
  product_code    TEXT NOT NULL,
  product_name    TEXT NOT NULL,
  color_id        INT,
  color_name      TEXT,
  
  -- Canvas data (JSONB — the full serialised canvas per view)
  canvas_data     JSONB NOT NULL,    -- Record<viewKey, CanvasState>
  
  -- Derived specs
  placements      JSONB NOT NULL,    -- DesignPlacement[]
  
  -- Personalisation
  personalisation_fields  JSONB,     -- PersonalisationField[]
  personalisation_data    JSONB,     -- PersonalisationRow[]
  
  -- Proof
  thumbnail_url   TEXT,
  proof_url       TEXT,
  proof_version   INT DEFAULT 0,
  
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_designs_job ON designs(job_id);
CREATE INDEX idx_designs_account ON designs(account_id);
CREATE INDEX idx_designs_template ON designs(template_id);
CREATE INDEX idx_designs_status ON designs(status);

-- Design version history
CREATE TABLE design_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id       UUID NOT NULL REFERENCES designs(id),
  version         INT NOT NULL,
  canvas_data     JSONB NOT NULL,
  placements      JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL,
  change_summary  TEXT
);

-- Templates
CREATE TABLE design_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INT NOT NULL DEFAULT 1,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,             -- school-leavers, workwear, sports, corporate, events
  scope           TEXT NOT NULL DEFAULT 'global', -- global, account, campaign
  account_id      UUID REFERENCES accounts(id),
  campaign_id     UUID,
  
  product_type    TEXT NOT NULL,     -- hoodie, tshirt, cap, etc.
  product_codes   TEXT[],           -- Specific products, null = any of type
  
  canvas_data     JSONB NOT NULL,
  object_permissions JSONB NOT NULL, -- Record<objectId, {locked, editable, replaceable, hidden}>
  personalisation_fields JSONB,
  default_methods JSONB,            -- Record<zoneKey, methodCode>
  
  thumbnail_url   TEXT,
  preview_urls    JSONB,            -- Record<view, url>
  decoration_surcharge INT DEFAULT 0,
  
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL
);

CREATE INDEX idx_templates_scope ON design_templates(scope, account_id);
CREATE INDEX idx_templates_product ON design_templates(product_type);

-- Artwork library
CREATE TABLE artwork_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT NOT NULL DEFAULT 'global', -- global, account, internal
  account_id      UUID REFERENCES accounts(id),
  
  name            TEXT NOT NULL,
  filename        TEXT NOT NULL,
  file_type       TEXT NOT NULL,     -- png, svg, eps, ai, pdf, dst, pes
  file_size       INT NOT NULL,      -- bytes
  file_url        TEXT NOT NULL,     -- S3/R2 URL
  preview_url     TEXT,              -- Converted preview
  thumbnail_url   TEXT,
  
  natural_width   INT,
  natural_height  INT,
  dpi             INT,
  color_count     INT,
  colors          JSONB,            -- Extracted colour list
  
  category        TEXT,             -- logos, icons, backgrounds, sport, school
  tags            TEXT[],
  
  version         INT NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES artwork_library(id),
  
  uploaded_by     TEXT NOT NULL,
  moderation_status TEXT DEFAULT 'approved', -- pending, approved, rejected
  
  usage_count     INT NOT NULL DEFAULT 0,
  
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artwork_scope ON artwork_library(scope, account_id);
CREATE INDEX idx_artwork_tags ON artwork_library USING gin(tags);
CREATE INDEX idx_artwork_category ON artwork_library(category);

-- Fonts
CREATE TABLE decorator_fonts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,     -- Display name
  family          TEXT NOT NULL,     -- CSS font-family value
  category        TEXT,             -- serif, sans-serif, script, display, monospace
  file_url        TEXT NOT NULL,     -- WOFF2 URL
  fallback_urls   JSONB,            -- {ttf: "...", otf: "..."}
  
  weight_range    TEXT DEFAULT '400', -- "400" or "100-900"
  has_italic      BOOLEAN DEFAULT false,
  
  preview_url     TEXT,              -- Sample text render
  
  customer_visible BOOLEAN DEFAULT true,
  method_restrictions TEXT[],        -- Methods that can use this font, null = all
  sort_order      INT DEFAULT 0,
  
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product decoration zones
CREATE TABLE product_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope: specific product OR product type default
  product_code    TEXT,              -- Specific product (null = type default)
  product_type    TEXT NOT NULL,     -- hoodie, tshirt, etc.
  
  key             TEXT NOT NULL,     -- "left_chest", "full_back", etc.
  label           TEXT NOT NULL,     -- "Left Chest"
  view            TEXT NOT NULL,     -- "front", "back", "left", "right", custom
  
  -- Position on canvas (%)
  x               DECIMAL NOT NULL,
  y               DECIMAL NOT NULL,
  w               DECIMAL NOT NULL,
  h               DECIMAL NOT NULL,
  
  -- Physical dimensions (mm)
  actual_width_mm   DECIMAL NOT NULL,
  actual_height_mm  DECIMAL NOT NULL,
  
  rotation        DECIMAL DEFAULT 0,
  clip_path       TEXT,              -- SVG path for non-rectangular zones
  
  allowed_methods TEXT[] NOT NULL DEFAULT '{}',
  max_colors      INT DEFAULT 20,
  min_dpi         INT DEFAULT 150,
  is_required     BOOLEAN DEFAULT false,
  
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  
  UNIQUE(product_code, product_type, key)
);

CREATE INDEX idx_zones_product ON product_zones(product_code, product_type);

-- Decoration pricing rules
CREATE TABLE decoration_price_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method          TEXT NOT NULL,     -- WEMB, DTG, DTF, RHS, TRF, SUB, VNL
  name            TEXT NOT NULL,
  
  setup_fee       INT NOT NULL DEFAULT 0,       -- pence
  per_unit_base   INT NOT NULL DEFAULT 0,       -- pence
  
  per_thousand_stitches  INT,        -- Embroidery
  per_color              INT,        -- Screen print per colour per unit
  per_color_setup        INT,        -- Screen print setup per colour
  
  size_brackets   JSONB,            -- DTG/DTF brackets
  quantity_breaks JSONB NOT NULL DEFAULT '[]',
  
  personalisation_per_item  INT DEFAULT 0,
  personalisation_per_field INT DEFAULT 0,
  
  minimum_quantity    INT DEFAULT 1,
  minimum_order_value INT DEFAULT 0,
  
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved team rosters
CREATE TABLE team_rosters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  name            TEXT NOT NULL,     -- "2025/26 First XI"
  sport           TEXT,
  
  members         JSONB NOT NULL,    -- [{name, number, size, position, ...}]
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rosters_account ON team_rosters(account_id);

-- Proof records
CREATE TABLE proofs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id       UUID NOT NULL REFERENCES designs(id),
  job_id          UUID REFERENCES jobs(id),
  version         INT NOT NULL DEFAULT 1,
  
  pdf_url         TEXT,
  png_urls        JSONB,            -- Per-view renders
  
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, sent, approved, rejected, changes_requested
  sent_at         TIMESTAMPTZ,
  sent_to         TEXT,              -- Email address
  responded_at    TIMESTAMPTZ,
  response_notes  TEXT,
  
  watermarked     BOOLEAN DEFAULT true,
  auto_approved   BOOLEAN DEFAULT false,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL
);

CREATE INDEX idx_proofs_design ON proofs(design_id);
CREATE INDEX idx_proofs_job ON proofs(job_id);
CREATE INDEX idx_proofs_status ON proofs(status);
```

---

## 8. Workflows

### 8.1 New Job — Full Decoration Workflow

```
1. ORDER RECEIVED (Shopify / manual / Deco)
   ├── Job created, classified, account matched
   └── Line items created with products

2. DECORATION CONFIGURATION
   ├── Staff opens decorator for line item
   ├── Product images + zones loaded
   ├── If account has templates → auto-apply template
   ├── Staff/customer places artwork, adds text, configures each zone
   ├── Sets method, colours, dimensions per zone
   ├── Adds personalisation fields + data if needed
   ├── Design saved → linked to job item
   └── Job configuration status → DECORATED

3. PROOF GENERATION
   ├── Staff clicks "Generate Proof"
   ├── Server renders design on product at 300 DPI
   ├── PDF assembled (views, spec sheet, personalisation summary)
   ├── Proof stored, version incremented
   └── Proof sent to customer (email with approve/reject links)

4. APPROVAL
   ├── Customer opens proof link
   ├── Reviews mockups and specs
   ├── Approves → design status → approved → job → AWAITING_STOCK
   ├── Rejects → adds comments → staff revises → re-proof (goto 3)
   └── Auto-approved (template/repeat) → skip to step 5

5. PRODUCTION PREPARATION
   ├── Design status → production_ready
   ├── Print-ready artwork exported per placement
   ├── Production spec sheet generated
   ├── Personalisation manifest generated (if applicable)
   ├── Gang sheet optimisation (DTF)
   ├── Colour separations (screen print)
   └── Job → PRODUCTION_QUEUED

6. PRODUCTION
   ├── Production team receives job ticket + artwork + manifest
   ├── Items produced per spec
   ├── Personalised items matched by barcode labels
   └── Job → IN_PRODUCTION → COMPLETED

7. FULFILMENT
   ├── Quality check against proof
   ├── Pack and ship
   └── Job → SHIPPED
```

### 8.2 Pre-Decorated Product Creation

```
1. Admin opens Template Builder
2. Selects product type (e.g. hoodie)
3. Places artwork and text in zones
4. Marks objects: locked brand logo, editable name field
5. Defines personalisation fields (name, number)
6. Sets default decoration methods
7. Saves template

8. Admin creates Pre-Decorated Product
   ├── Links template to products (W72, W73, etc.)
   ├── Sets pricing (base + decoration surcharge)
   ├── Generates preview images
   └── Publishes to storefront

9. Customer browses pre-decorated products
   ├── Sees product with decoration already shown
   ├── Clicks "Personalise" (if personalisation enabled)
   ├── Fills in name/number fields
   ├── Sees live preview update
   ├── Adds to cart
   └── Order flows to job with template + personalisation applied
```

### 8.3 Bulk Order with Names/Numbers

```
1. Customer or staff selects product
2. Opens decorator, applies team template or places artwork
3. Enables personalisation for name + number zones
4. Switches to "Bulk Entry" tab
5. Option A: Paste or type names/numbers in grid editor
   Option B: Upload CSV with Name, Number, Size columns
6. System maps columns, validates all rows
7. Staff reviews per-row preview (click row → see garment with that name/number)
8. Confirms → order created with N×1 items (one per personalisation row)
9. Each item has individual name/number in production data
10. Production receives personalisation manifest
11. Each item gets barcode label for matching after production
```

---

## 9. Validation Rules and Constraints

### 9.1 Canvas Validation

| Rule | Level | Detail |
|------|-------|--------|
| Artwork within zone bounds | Warning | Artwork should not exceed zone boundary; visual indicator + warning |
| Minimum DPI | Error (customer) / Warning (staff) | Based on method: DTG ≥150, screen ≥300; calculated from image natural size vs placed size |
| Maximum print size | Error | Cannot exceed zone physical dimensions |
| Minimum print size | Warning | Below 10mm in either dimension |
| Colour count | Error | Exceeds method maximum (e.g. screen print 8 colours) |
| Vector required | Error | Vinyl/flex method requires vector artwork (SVG) |
| No gradients | Error | Embroidery and vinyl do not support gradients |
| Minimum line width | Warning | Embroidery minimum 1mm lines; vinyl minimum 2mm details |
| Font availability | Error | Selected font must be active and allowed for method |
| Required zones | Error | All zones marked `isRequired` must have a design before approval |
| Personalisation complete | Error | All required personalisation fields must be filled |
| File format supported | Error | Uploaded file must be in accepted format list |
| File size limit | Error | Upload must be under configured maximum (default 50MB) |

### 9.2 Business Validation

| Rule | Level | Detail |
|------|-------|--------|
| Minimum order quantity | Error | Per-method minimum quantity enforced |
| Minimum order value | Error | Order total must meet minimum |
| Margin threshold | Warning | Warn if calculated margin below configured minimum % |
| Artwork moderation | Block | Customer uploads held for review if moderation enabled |
| Proof required | Block | Cannot move to production without approved proof (unless auto-approved) |
| Personalisation validation | Error | Per-row: max length, required fields, valid characters, valid size codes |
| Method vs product | Error | Cannot apply method to product that doesn't support it (e.g. sublimation on cotton) |
| Dark garment rules | Warning | DTG on dark garments requires white underbase acknowledgment |

---

## 10. MVP vs Later-Phase Roadmap

### Phase 1 — MVP (replaces existing designer-modal)

**Goal:** Replace current modal with a proper canvas-based decorator for internal staff use.

| Feature | What ships |
|---------|-----------|
| **Canvas engine** | Fabric.js canvas with move/resize/rotate/layers, undo/redo, zoom/pan |
| **Product views** | Front/back/side views with colour-matched Deco images (existing pipeline) |
| **Zones** | Zone definitions per product type, visual zone boundaries on canvas |
| **Text tool** | Add/edit text with font selection, size, colour, alignment |
| **Image upload** | Drag-drop + file picker, PNG/JPG/SVG/PDF/EPS/AI support with conversion |
| **Artwork placement** | Position within zone, resize, rotate, flip, snap to centre |
| **Method selection** | 7 methods with method-specific fields (stitch count, colour count, PMS) |
| **DPI indicator** | Show effective DPI, warn if below threshold |
| **Size presets** | Quick-apply standard placements (left chest, full back, etc.) |
| **Design save/load** | Save design to job item, reload when editing |
| **Proof generation** | Basic proof PDF (product mockup + spec sheet) |
| **Font library** | 10-15 pre-loaded web fonts, admin upload later |
| **Notes** | Per-zone production notes |

**Not in MVP:** Stored artwork library, templates, personalisation, bulk names, pricing engine, customer-facing, pre-decorated products, approval workflow.

**Estimated scope:** Canvas engine + product/zone integration + text tool + improved image handling + proof PDF.

### Phase 2 — Artwork Library and Templates

| Feature | What ships |
|---------|-----------|
| **Artwork library** | Global and per-account artwork storage in S3/R2, browse/search/tag |
| **SVG recolouring** | Parse SVG, present colour swatches, change fill/stroke |
| **Background removal** | Server-side rembg integration |
| **Template system** | Create templates with locked/editable/replaceable regions |
| **Template application** | Apply template to product, customer fills editable fields |
| **Design versioning** | Version history per design |
| **Approval workflow** | Proof → email → approve/reject → re-proof cycle |

### Phase 3 — Personalisation and Pricing

| Feature | What ships |
|---------|-----------|
| **Personalisation fields** | Name/number/initials/custom bound to text objects |
| **Single-item entry** | Customer fills personalisation in decorator |
| **Bulk CSV upload** | Upload roster, map columns, validate, preview per row |
| **Team roster saving** | Save/load rosters per account |
| **Pricing engine** | Per-method pricing rules, quantity breaks, live price in decorator |
| **Personalisation pricing** | Surcharge per personalised item/field |
| **Minimum order enforcement** | Quantity and value minimums per method |

### Phase 4 — Customer-Facing and Production

| Feature | What ships |
|---------|-----------|
| **Customer decorator** | Simplified decorator for storefront (restricted methods, curated fonts, moderated uploads) |
| **Pre-decorated products** | Template + product = sellable decorated SKU |
| **Campaign mode** | Account portal with pre-configured products |
| **Production outputs** | Print-ready artwork export, colour separations, mirror for transfer |
| **Gang sheet optimisation** | DTF auto-layout for transfer sheets |
| **Embroidery stitch estimation** | Auto-estimate from design analysis |
| **Barcode labels** | Per-unit labels for personalised items |
| **Production manifest** | CSV/PDF for production floor |

### Phase 5 — Advanced

| Feature | What ships |
|---------|-----------|
| **Smart Select** | Auto-suggest method based on product material/type/finish |
| **Custom zone shapes** | SVG clip path zones for non-rectangular areas |
| **Embroidery file export** | DST/PES generation or digitise-request workflow |
| **Vinyl cut paths** | SVG/DXF export with weeding lines |
| **Curved text** | Arc text for caps/circular designs |
| **3D preview** | Three.js garment wrap for photo-realistic preview |
| **Multi-user collaboration** | Real-time shared canvas editing |
| **Mobile-optimised** | Touch-first interface for tablets in production |

---

## 11. Technical Architecture

### 11.1 Stack

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND                           │
│                                                      │
│  Next.js 14 (App Router)                             │
│  ├── Decorator Component (React)                     │
│  │   ├── Canvas Engine (Fabric.js 6.x)               │
│  │   ├── UI Panels (Radix UI + Tailwind)             │
│  │   └── State Management (Zustand store)            │
│  ├── Admin Pages (font/template/artwork/zone mgmt)   │
│  └── Customer Decorator (restricted mode)            │
│                                                      │
├──────────────────────────────────────────────────────┤
│                    BACKEND                            │
│                                                      │
│  Fastify (existing backend service)                  │
│  ├── Decorator Routes                                │
│  │   ├── /designs — CRUD + versioning                │
│  │   ├── /artwork — upload, convert, library         │
│  │   ├── /templates — CRUD + apply                   │
│  │   ├── /fonts — management                         │
│  │   ├── /zones — product zone CRUD                  │
│  │   ├── /pricing — rules + calculation              │
│  │   └── /proofs — generate, send, approve           │
│  ├── Prisma ORM (existing)                           │
│  └── BullMQ Workers (existing queue system)          │
│      ├── artwork-convert worker                      │
│      ├── proof-render worker                         │
│      ├── background-remove worker                    │
│      └── thumbnail-generate worker                   │
│                                                      │
├──────────────────────────────────────────────────────┤
│                   STORAGE                             │
│                                                      │
│  PostgreSQL (existing — Prisma managed)              │
│  ├── designs, design_versions, design_templates      │
│  ├── artwork_library, decorator_fonts, product_zones │
│  ├── decoration_price_rules, team_rosters, proofs    │
│  └── existing tables (jobs, job_items, accounts...)  │
│                                                      │
│  Cloudflare R2 / AWS S3                              │
│  ├── /artwork/originals/{id}/{filename}              │
│  ├── /artwork/previews/{id}.png                      │
│  ├── /artwork/thumbnails/{id}.webp                   │
│  ├── /fonts/{id}.woff2                               │
│  ├── /proofs/{jobId}/v{n}.pdf                        │
│  └── /designs/{id}/thumbnail.webp                    │
│                                                      │
├──────────────────────────────────────────────────────┤
│              PROCESSING SERVICES                      │
│                                                      │
│  Headless Inkscape (EPS/AI/CDR → SVG conversion)     │
│  Ghostscript (PDF → PNG/SVG)                         │
│  Sharp (image resize, crop, format conversion)       │
│  rembg (Python — background removal)                 │
│  Puppeteer (proof PDF generation from HTML template)  │
│  ImageMagick (colour analysis, DPI check)            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 11.2 Canvas Architecture

```typescript
// Zustand store for decorator state
interface DecoratorStore {
  // Product
  product: DesignerProductDetail;
  garmentType: GarmentType;
  selectedColorId: number;
  
  // Views and zones
  activeView: string;
  activeZoneId: string | null;
  zones: ZoneDefinition[];
  
  // Canvas state per view
  canvasStates: Record<string, CanvasState>;
  
  // Design objects
  objects: DesignObject[];
  selectedObjectIds: string[];
  
  // History
  undoStack: CanvasState[];
  redoStack: CanvasState[];
  
  // UI state
  activeTool: "select" | "text" | "upload" | "pan";
  rightPanel: "properties" | "method" | "artwork" | "text" | "personalisation" | "notes";
  zoom: number;
  
  // Artwork
  uploads: UploadedFile[];
  artworkLibrary: ArtworkItem[];
  
  // Method & pricing
  zoneMethodMap: Record<string, string>;
  priceCalculation: PriceCalculation | null;
  
  // Personalisation
  personalisationFields: PersonalisationField[];
  personalisationData: PersonalisationRow[];
  
  // Actions
  addTextObject(zoneId: string): void;
  addImageObject(zoneId: string, fileId: string): void;
  updateObject(id: string, changes: Partial<DesignObject>): void;
  deleteObjects(ids: string[]): void;
  setActiveZone(zoneId: string): void;
  setActiveView(view: string): void;
  setMethod(zoneId: string, method: string): void;
  undo(): void;
  redo(): void;
  saveDesign(): Promise<string>;
  loadDesign(designId: string): Promise<void>;
  generateProof(): Promise<string>;
  calculatePrice(): Promise<PriceCalculation>;
}
```

### 11.3 Component Structure

```
<Decorator>
  ├── <DecoratorHeader>
  │     Product name, colour selector, view count, design count, price summary
  │
  ├── <DecoratorToolbar>
  │     Select, Text, Upload, Pan, Zoom, Undo, Redo, Grid, Rulers
  │
  ├── <DecoratorBody>
  │   ├── <ViewSidebar>                     (left, 220px)
  │   │     View buttons (Front/Back/Left/Right)
  │   │     Zone list per view (with status dots)
  │   │     Colour palette
  │   │
  │   ├── <CanvasArea>                      (centre, flex)
  │   │   ├── <FabricCanvas>               (the actual canvas)
  │   │   │     Background layer (product image or SVG)
  │   │   │     Zone boundary layer (dashed rects)
  │   │   │     Objects layer (text, images, shapes)
  │   │   │     Selection handles layer
  │   │   │     Snap guides layer
  │   │   └── <CanvasOverlay>
  │   │         DPI indicator, zone label, dimension readout
  │   │
  │   └── <PropertiesPanel>                 (right, 320px)
  │       ├── <ZoneHeader>                  Zone name, method badge, clear button
  │       ├── <MethodPicker>               6-method grid with icons
  │       ├── <PropertiesTab>
  │       │     <TransformControls>         X, Y, W, H, rotation, flip, lock aspect
  │       │     <SizeInMm>                  Real-world dimensions, presets
  │       │     <MethodSpecificFields>      Stitch count, colour count, PMS
  │       ├── <TextTab>                     (when text selected)
  │       │     <FontPicker>
  │       │     <FontSizeSlider>
  │       │     <TextStyleToggles>          Bold, italic, underline
  │       │     <TextAlignButtons>
  │       │     <TextColorPicker>
  │       │     <LineSpacingSlider>
  │       │     <LetterSpacingSlider>
  │       ├── <ArtworkTab>
  │       │     <UploadDropZone>
  │       │     <UploadedFilesList>
  │       │     <ArtworkLibraryBrowser>     Search, filter, browse account/global
  │       │     <SvgColorEditor>           (when SVG selected)
  │       │     <ImageAdjustments>          Brightness, contrast, remove BG
  │       │     <DpiIndicator>
  │       ├── <PersonalisationTab>
  │       │     <FieldDefinitions>          Add/edit fields bound to text objects
  │       │     <SingleEntryForm>           Fill fields for one item
  │       │     <BulkUploadPanel>           CSV upload, column mapping, grid editor
  │       │     <RosterSelector>            Load saved roster
  │       │     <PreviewByRow>              Click row → see that person's design
  │       └── <NotesTab>
  │             <NotesTextarea>
  │             <QuickAddButtons>
  │
  └── <DecoratorFooter>
        Configured zones summary
        Price breakdown (expandable)
        Cancel, Save Draft, Generate Proof, Apply
```

### 11.4 API Route Structure

```
/api/v1/decorator/
  ├── designs/
  │   ├── POST /                    Create design
  │   ├── GET /:id                  Load design
  │   ├── PUT /:id                  Update design
  │   ├── GET /:id/versions         Version history
  │   └── POST /:id/duplicate       Clone design
  │
  ├── artwork/
  │   ├── POST /upload              Get presigned upload URL
  │   ├── POST /:id/process         Trigger conversion pipeline
  │   ├── POST /:id/remove-bg       Background removal
  │   ├── GET /:id                  File metadata + URLs
  │   └── DELETE /:id               Soft delete
  │
  ├── library/
  │   ├── GET /                     Browse (global + account)
  │   ├── GET /account/:accountId   Account-specific
  │   ├── POST /                    Add artwork to library
  │   ├── PUT /:id                  Update tags/metadata
  │   └── DELETE /:id               Remove
  │
  ├── templates/
  │   ├── GET /                     List templates
  │   ├── GET /:id                  Template detail
  │   ├── POST /                    Create template
  │   ├── PUT /:id                  Update (new version)
  │   ├── POST /:id/apply           Apply to product → returns new design
  │   └── DELETE /:id               Archive
  │
  ├── fonts/
  │   ├── GET /                     List active fonts
  │   ├── POST /                    Upload font
  │   ├── PUT /:id                  Update settings
  │   └── DELETE /:id               Deactivate
  │
  ├── zones/
  │   ├── GET /product/:code        Zones for specific product
  │   ├── GET /type/:type           Default zones for product type
  │   ├── POST /                    Create zone
  │   ├── PUT /:id                  Update zone
  │   └── DELETE /:id               Deactivate
  │
  ├── pricing/
  │   ├── GET /rules                List pricing rules
  │   ├── POST /rules               Create rule
  │   ├── PUT /rules/:id            Update rule
  │   ├── POST /calculate           Calculate price for design config
  │   └── DELETE /rules/:id         Deactivate
  │
  ├── proofs/
  │   ├── POST /generate            Generate proof from design
  │   ├── GET /:id                  Proof detail
  │   ├── POST /:id/send            Email proof to customer
  │   ├── POST /:id/approve         Mark approved
  │   ├── POST /:id/reject          Mark rejected with notes
  │   └── GET /design/:designId     All proofs for a design
  │
  └── personalisation/
      ├── POST /validate-csv        Validate uploaded CSV
      ├── POST /parse-csv           Parse CSV → PersonalisationRow[]
      ├── GET /rosters/:accountId   List saved rosters
      ├── POST /rosters             Save roster
      └── DELETE /rosters/:id       Delete roster
```

### 11.5 Fabric.js Integration

The canvas uses Fabric.js 6.x wrapped in a React component. Key integration points:

```typescript
// Canvas wrapper component
function FabricCanvas({ 
  state, 
  onObjectModified, 
  onSelectionChanged,
  activeZone 
}: FabricCanvasProps) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  
  useEffect(() => {
    // Initialise canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
    });
    
    // Set up event handlers
    canvas.on('object:modified', (e) => onObjectModified(serialise(e.target)));
    canvas.on('selection:created', (e) => onSelectionChanged(e.selected.map(o => o.data.id)));
    canvas.on('selection:cleared', () => onSelectionChanged([]));
    
    // Add snap-to-centre guides
    canvas.on('object:moving', (e) => handleSnapping(e, canvas, activeZone));
    
    return () => canvas.dispose();
  }, []);
  
  // Sync state → canvas
  useEffect(() => { syncObjectsToCanvas(canvasRef.current, state.objects); }, [state.objects]);
  useEffect(() => { renderZoneBoundaries(canvasRef.current, state.zones, activeZone); }, [state.zones, activeZone]);
  useEffect(() => { setBackground(canvasRef.current, state); }, [state.backgroundImage, state.garmentColor]);
  
  return <canvas ref={canvasRef} />;
}
```

### 11.6 File Processing Pipeline

```
Upload request
  → Generate presigned S3/R2 URL
  → Client uploads directly to storage
  → Client calls POST /artwork/:id/process
  → Backend queues processing job (BullMQ)
  → Worker picks up job:
    1. Download file from storage
    2. Detect file type (magic bytes, not just extension)
    3. Route to appropriate converter:
       ├── PNG/JPG/WEBP → Sharp: resize thumbnail, extract metadata (DPI, dimensions)
       ├── SVG → Parse, extract colours, generate PNG preview
       ├── EPS/AI → Inkscape headless: convert to SVG + PNG preview
       ├── PDF → Ghostscript: extract page 1 as PNG, attempt SVG conversion
       ├── CDR → Inkscape/LibreOffice: best-effort conversion
       └── DST/PES/JEF/EXP/VP3/HUS → Stitch renderer: generate stitch preview PNG
    4. Upload preview + thumbnail to storage
    5. Store metadata in artwork_library / artwork file record
    6. Update status: ready
  → Client polls or receives websocket notification
  → Canvas loads preview image
```

### 11.7 Proof Generation Pipeline

```
Generate proof request
  → Backend queues proof job (BullMQ)
  → Worker:
    1. Load design from database
    2. For each view in design:
       a. Load product image at high resolution
       b. Render design objects onto product image using headless canvas (node-canvas or Puppeteer)
       c. Apply zone clipping
       d. Add watermark if customer-facing
       e. Save rendered view as PNG
    3. Generate spec sheet:
       a. Table of placements with method, dimensions, colours
       b. PMS colour swatches
       c. Font list
    4. Generate personalisation summary (if applicable)
    5. Assemble PDF (cover + views + spec + personalisation + terms)
    6. Upload PDF to storage
    7. Create proof record in database
  → Return proof URL
```

---

## Appendix A: Garment Type Zone Defaults

| Type | Views | Default Zones |
|------|-------|--------------|
| **T-shirt** | Front, Back | Left Chest (80×80mm), Right Chest (80×80mm), Centre Chest (300×200mm), Main Body (350×400mm), Full Back (350×400mm), Left Sleeve (100×80mm), Right Sleeve (100×80mm) |
| **Polo** | Front, Back | Left Chest (80×80mm), Right Chest (80×80mm), Centre Chest (250×150mm), Full Back (300×350mm), Left Sleeve (80×60mm), Right Sleeve (80×60mm) |
| **Hoodie** | Front, Back, Left, Right | Left Chest (80×80mm), Right Chest (80×80mm), Centre Chest (300×200mm), Main Body (350×400mm), Kangaroo Pocket (250×150mm), Full Back (350×400mm), Hood (150×100mm), Left Sleeve (120×80mm), Right Sleeve (120×80mm) |
| **Jacket** | Front, Back, Left, Right | Left Chest (80×80mm), Right Chest (80×80mm), Full Back (350×400mm), Left Sleeve (120×80mm), Right Sleeve (120×80mm), Left Inner (250×300mm) |
| **Gilet** | Front, Back | Left Chest (80×80mm), Right Chest (80×80mm), Full Back (300×350mm) |
| **Hi-Vis** | Front, Back | Left Chest (80×80mm, above tape), Right Chest (80×80mm), Full Back (300×250mm, between tapes) |
| **Trousers** | Front, Back | Left Leg (80×60mm), Right Leg (80×60mm), Rear Pocket (60×50mm), Front Pocket (60×50mm) |
| **Cap** | Front, Back, Left, Right | Front Panel (100×60mm), Back Strap (80×25mm), Left Side (80×40mm), Right Side (80×40mm) |
| **Beanie** | Front, Back | Front Centre (100×60mm), Turn-back (200×50mm) |
| **Bag** | Front, Back | Front Panel (250×250mm), Back Panel (250×250mm), Flap (200×100mm) |
| **Apron** | Front | Chest (250×150mm), Pocket (200×120mm) |
| **Towel** | Front | Full (500×300mm), Border (500×80mm) |

## Appendix B: Supported Decoration Methods Reference

| Code | Name | Icon | Requires Vector | Supports Gradients | Colour Model | Default Min DPI |
|------|------|------|-----------------|-------------------|-------------|-----------------|
| WEMB | Embroidery | 🧵 | Preferred | No | Thread palette | N/A |
| DTG | Direct to Garment | 🎯 | No | Yes | CMYK+W | 150 |
| DTF | Direct to Film | 🖨️ | No | Yes | CMYK+W | 200 |
| RHS | Screen Print | 🖼️ | Preferred | Halftone only | PMS Spot | 300 |
| TRF | Transfer | ♨️ | No | Yes | CMYK | 200 |
| SUB | Sublimation | 🌈 | No | Yes | CMYK | 200 |
| VNL | Vinyl/Flex | ✂️ | Required | No | Spot | N/A |
| UVP | UV Print | 💡 | No | Yes | CMYK+W | 300 |

## Appendix C: Integration Points with Existing System

| Existing Entity | Integration |
|---|---|
| `Job` | Design linked via `designs.job_id`; proof status synced to `Job.approvalStatus`; production outputs trigger `Job.productionStatus` transition |
| `JobItem` | Design linked via `designs.job_item_id`; decoration method, placement, custom options derived from design placements |
| `Account` | Templates scoped to account; artwork library per account; placement configs from `AccountPlacementConfig`; product rules from `AccountProductRule` |
| `AccountAsset` | Migrated to `artwork_library` with `scope=account`; `decoDesignId` and `decoTemplateId` kept for Deco sync |
| `DecoProduct` | Product code links design to catalog; colour/size data from Deco API; images from existing multi-source pipeline |
| `CatalogProduct` / `CatalogColour` | Front/back/side images with RGB values feed product views; image pipeline already provides colour-matched views |
| `ExternalLink` | Deco design ID stored as external link for sync reference |
| `Communication` | Proof emails logged as communications; approval notifications tracked |
| `ActivityLog` | Design save, proof send, approval, rejection logged as activities |
| BullMQ queues | Artwork processing, proof generation, background removal run as queued workers alongside existing sync workers |
