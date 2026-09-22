import { useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  Activity,
  ArrowLeft,
  BadgeIndianRupee,
  Banknote,
  Camera,
  CalendarDays,
  CheckCircle2,
  Crown,
  Download,
  FileImage,
  Gavel,
  ImageIcon,
  KeyRound,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  MapPin,
  MonitorUp,
  Pencil,
  Phone,
  Plus,
  Printer,
  Search,
  Save,
  Shield,
  Shuffle,
  Star,
  Trash2,
  Trophy,
  Upload,
  User,
  UserPlus,
  Users,
  WalletCards,
  X
} from 'lucide-react';
import { hasSupabaseConfig, supabase } from './lib/supabase';

const suggestedTeamCounts = [2, 4, 8, 10, 12, 14, 16, 20, 24, 32];
const defaultTeamLimit = 16;
const blankTeam = {
  team_name: '',
  owner_name: '',
  owner_mobile: '',
  owner_pin: '',
  total_budget: '100000',
  remaining_budget: '100000',
  max_players: ''
};
const defaultPlayerCriteria = 'Silver Player';

const blankPlayer = {
  full_name: '',
  mobile_number: '',
  photo_url: '',
  photo_path: '',
  base_price: '1000',
  category: 'All-rounder',
  player_criteria: defaultPlayerCriteria,
  tshirt_size: 'M',
  tshirt_number: '',
  paid_amount: '',
  payment_screenshot_url: '',
  aadhaar_card_url: '',
  stats: '{}'
};
const blankRegistration = {
  ...blankPlayer,
  paid_amount: ''
};
const blankTournament = {
  name: '',
  start_date: '',
  end_date: '',
  auction_end_date: '',
  address: '',
  logo_url: '',
  description: ''
};
const defaultWebsiteContent = {
  hero: {
    eyebrow: 'Cricket Players Auction',
    title: '',
    lead: 'Register players, verify payments, run live bidding, track team purse, and show the auction on projector screens in real time.'
  },
  popup: {
    enabled: false,
    title: 'Registration Open',
    message: 'New player registration is open for the upcoming CPL auction.',
    button_label: 'Register Now'
  },
  about: {
    eyebrow: 'About CPL',
    title: 'Professional auction management for cricket tournaments',
    body: 'CPL Auction System tournament organisers, team owners, players aur audience ke liye ek connected platform hai. Admin panel se teams, players, registration files, bidding, sold price aur standings manage hote hain.'
  },
  contact: {
    title: 'CPL Auction Desk',
    address: '',
    phone_1: '',
    phone_2: '',
    email: ''
  },
  payment_qr_url: '',
  testimonials: [
    { name: 'Team Owner', text: 'Auction room, purse tracking aur player registration ek hi jagah manage ho jata hai.', image_url: '' },
    { name: 'Player', text: 'Registration simple hai, aur auction status live dashboard par turant dikhta hai.', image_url: '' },
    { name: 'Auctioneer', text: 'Bidding controls fast hain, projector view clean hai, aur team budget validation automatic hai.', image_url: '' }
  ],
  gallery: []
};
const playerCategories = ['Batter', 'Bowler', 'All-rounder', 'Wicket Keeper'];
const playerCriteriaOptions = ['Silver Player', 'Gold Player', 'Platinum Player', 'Diamond Player', 'Icon Player'];
const tshirtSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
const photoBucket = 'cpl-player-photos';
const bidIncrement = 1000;
const auctionResultDisplayMs = 4000;
const defaultPassportCrop = { x: 0, y: 0, zoom: 1.08, croppedAreaPixels: null };
const passportAspectRatio = 3 / 4;
const passportPhotoWidth = 360;
const passportPhotoHeight = 480;
const passportPhotoPadding = 32;
const passportBackgroundColor = '#ffffff';
const fixedAdminId = 'admin';
const fixedAdminPassword = 'admin123';
const fixedAdminEmail = 'admin@cpl.com';
const fixedSubAdminId = 'subadmin';
const fixedSubAdminPassword = '12345';
const sharedVisitorCounterKey = 'visitor_count';
const sharedVisitorSessionKey = 'cpl-shared-visitor-counted';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function numericText(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStats(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return { note: String(value) };
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rowsToObjects(rows);
}

function rowsToObjects(rows) {
  const rawRows =
    Array.isArray(rows?.data) ? rows.data
      : Array.isArray(rows) && rows.length === 1 && Array.isArray(rows[0]?.data) ? rows[0].data
        : Array.isArray(rows) ? rows
          : rows?.rows || [];
  const normalizedRows = rawRows
    .map((row) => {
      if (Array.isArray(row)) return row;
      if (row && typeof row === 'object') return Object.values(row);
      return [row];
    })
    .filter((row) => row.some((cell) => String(cell ?? '').trim()));

  const [headers = [], ...body] = normalizedRows;
  const normalizedHeaders = headers.map((header) =>
    String(header ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );

  return body
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) =>
      normalizedHeaders.reduce((record, header, index) => {
        record[header] = row[index] ?? '';
        return record;
      }, {})
    );
}

function formatMoney(value, currencyMode) {
  const number = toNumber(value, 0);
  if (currencyMode === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(number);
  }
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(number)} pts`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(startDate, endDate) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end) return `${start} to ${end}`;
  return start || end || 'Dates to be announced';
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isAuctionRegistrationClosed(tournament) {
  if (!tournament?.auction_end_date) return false;
  return localDateString() > tournament.auction_end_date;
}

function tournamentToForm(tournament) {
  return {
    name: tournament?.name || '',
    start_date: tournament?.start_date || '',
    end_date: tournament?.end_date || '',
    auction_end_date: tournament?.auction_end_date || '',
    address: tournament?.address || '',
    logo_url: tournament?.logo_url || '',
    description: tournament?.description || ''
  };
}

function teamToForm(team) {
  return {
    team_name: team?.team_name || '',
    owner_name: team?.owner_name || '',
    owner_mobile: team?.owner_mobile || '',
    owner_pin: team?.owner_pin || '',
    total_budget: String(team?.total_budget ?? ''),
    remaining_budget: String(team?.remaining_budget ?? ''),
    max_players: String(team?.max_players ?? ''),
    current_player_count: String(team?.current_player_count ?? 0)
  };
}

function playerToForm(player) {
  const stats = parseStats(player?.stats);
  return {
    full_name: player?.full_name || '',
    mobile_number: player?.mobile_number || '',
    photo_url: player?.photo_url || stats.photo_url || '',
    photo_path: player?.photo_path || '',
    base_price: String(player?.base_price ?? ''),
    category: player?.category || 'All-rounder',
    player_criteria: player?.player_criteria || stats.player_criteria || defaultPlayerCriteria,
    tshirt_size: player?.tshirt_size || stats.tshirt_size || 'M',
    tshirt_number: player?.tshirt_number || stats.tshirt_number || '',
    paid_amount: String(player?.paid_amount ?? stats.paid_amount ?? ''),
    payment_screenshot_url: player?.payment_screenshot_url || stats.payment_screenshot_url || '',
    aadhaar_card_url: player?.aadhaar_card_url || stats.aadhaar_card_url || '',
    stats: JSON.stringify(stats, null, 2)
  };
}

function titleCase(value) {
  return String(value || '').replace(/\S+/g, (word) => {
    if (/^[A-Z0-9&.-]{2,6}$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function pickField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function mergeWebsiteContent(content = {}) {
  return {
    ...defaultWebsiteContent,
    ...content,
    hero: { ...defaultWebsiteContent.hero, ...(content.hero || {}) },
    popup: { ...defaultWebsiteContent.popup, ...(content.popup || {}) },
    about: { ...defaultWebsiteContent.about, ...(content.about || {}) },
    contact: { ...defaultWebsiteContent.contact, ...(content.contact || {}) },
    payment_qr_url: content.payment_qr_url || '',
    testimonials: Array.isArray(content.testimonials) && content.testimonials.length
      ? content.testimonials
      : defaultWebsiteContent.testimonials,
    gallery: Array.isArray(content.gallery) ? content.gallery : []
  };
}

function websiteContentStorageKey(tournamentId) {
  return `cpl-website-content-${tournamentId || 'default'}`;
}

const websiteContentDbName = 'cpl-website-control-db';
const websiteContentStoreName = 'website_content';

function openWebsiteContentDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = window.indexedDB.open(websiteContentDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(websiteContentStoreName)) {
        db.createObjectStore(websiteContentStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB failed'));
  });
}

async function writeLocalWebsiteContent(tournamentId, content) {
  const key = websiteContentStorageKey(tournamentId);
  try {
    localStorage.setItem(key, JSON.stringify(content));
    return true;
  } catch {
    // Large uploaded images can exceed localStorage; IndexedDB handles bigger browser saves.
  }

  try {
    const db = await openWebsiteContentDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(websiteContentStoreName, 'readwrite');
      transaction.objectStore(websiteContentStoreName).put(content, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB save failed'));
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

async function readLocalWebsiteContent(tournamentId) {
  const key = websiteContentStorageKey(tournamentId);
  try {
    const saved = localStorage.getItem(key);
    if (saved) return mergeWebsiteContent(JSON.parse(saved));
  } catch {
    // Continue to IndexedDB fallback.
  }

  try {
    const db = await openWebsiteContentDb();
    const saved = await new Promise((resolve, reject) => {
      const transaction = db.transaction(websiteContentStoreName, 'readonly');
      const request = transaction.objectStore(websiteContentStoreName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
    });
    db.close();
    return saved ? mergeWebsiteContent(saved) : null;
  } catch {
    return null;
  }
}

function PlayerPhoto({ player, size = 'md' }) {
  const initial = player?.full_name?.trim()?.[0]?.toUpperCase() || 'P';
  const photoUrl = player?.photo_url || player?.stats?.photo_url;

  if (photoUrl) {
    return (
      <img
        className={classNames('player-photo', size)}
        src={photoUrl}
        alt={`${player.full_name} photo`}
        loading="lazy"
      />
    );
  }

  return <span className={classNames('player-photo fallback', size)}>{initial}</span>;
}

function BrandMonogram({ compact = false }) {
  return (
    <span className={classNames('brand-monogram', compact && 'compact')} aria-label="CPL logo">
      <span>CPL</span>
    </span>
  );
}

function PlayerCriteriaDatalist() {
  return (
    <datalist id="player-criteria-options">
      {playerCriteriaOptions.map((criteria) => (
        <option key={criteria} value={criteria} />
      ))}
    </datalist>
  );
}

function playerMeta(player, key) {
  return player?.[key] || player?.stats?.[key] || '';
}

function playerCriteria(player) {
  if (!player) return '';
  return playerMeta(player, 'player_criteria') || defaultPlayerCriteria;
}

function isTeamPlayer(player, teamId) {
  return player?.sold_status === 'Sold' && player?.assigned_team_id === teamId;
}

function soldPlayerPrice(player) {
  return toNumber(player?.final_bid_price || player?.base_price);
}

function teamSoldRoster(players, teamId) {
  return players.filter((player) => isTeamPlayer(player, teamId));
}

function teamSpend(players, teamId) {
  return teamSoldRoster(players, teamId).reduce((sum, player) => sum + soldPlayerPrice(player), 0);
}

function calculatedTeamRemaining(team, players) {
  return Math.max(0, toNumber(team?.total_budget) - teamSpend(players, team?.id));
}

function calculatedTeamPlayerCount(team, players) {
  return teamSoldRoster(players, team?.id).length;
}

async function syncTeamBudgetFromPlayers(team, players) {
  if (!team?.id) return { error: null };
  return supabase
    .from('teams')
    .update({
      remaining_budget: calculatedTeamRemaining(team, players),
      current_player_count: calculatedTeamPlayerCount(team, players)
    })
    .eq('id', team.id);
}

function fileExtension(file) {
  const fromName = file?.name?.split('.').pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();
  return file?.type?.split('/').pop() || 'file';
}

function friendlyUploadError(error) {
  const rawMessage = `${error?.message || error || ''}`;
  const text = rawMessage.toLowerCase();
  if (text.includes('duplicate key') || text.includes('23505')) {
    return 'Ye mobile number already saved hai.';
  }
  if (text.includes('player_criteria')) {
    return `Player criteria column missing hai. Supabase SQL Editor me database/add-player-criteria.sql run karo, phir 20 sec baad page refresh karo. Detail: ${rawMessage}`;
  }
  if (text.includes('players') && (text.includes('schema cache') || text.includes('relation') || text.includes('not found'))) {
    return `Players table/column not found. Supabase SQL Editor me database/allow-public-player-photo-save.sql run karo, phir 20 sec baad page refresh karo. Detail: ${rawMessage}`;
  }
  if (text.includes('owner_mobile') || text.includes('team_owner_credentials') || text.includes('team_owner_login') || text.includes('team_owner_place_bid')) {
    return `Team owner bidding setup missing. Supabase SQL Editor me database/add-team-owner-bidding.sql run karo, phir 20 sec baad page refresh karo. Detail: ${rawMessage}`;
  }
  if (text.includes('player_registrations') || text.includes('schema cache') || text.includes('relation') || text.includes('not found')) {
    return `Registration table/column not found. Same Supabase project me database/fix-registration-table-only.sql run karo, phir 20 sec baad page refresh karo. Detail: ${rawMessage}`;
  }
  if (text.includes('row-level security') || text.includes('rls') || text.includes('42501')) {
    return 'Player save permission blocked. Supabase SQL Editor me database/allow-public-player-photo-save.sql run karo.';
  }
  if (text.includes('too large') || text.includes('payload') || text.includes('413')) {
    return 'Selected image too large hai. Screenshot/photo thoda crop karke ya smaller image select karke submit karo.';
  }
  if (text.includes('image files only')) {
    return 'Player photo ke liye image file select karo.';
  }
  return error?.message || 'Save failed. Please try again.';
}

function friendlyScoringError(error) {
  const rawMessage = `${error?.message || error || ''}`;
  const text = rawMessage.toLowerCase();
  if (text.includes('matches') || text.includes('score_balls') || text.includes('schema cache') || text.includes('relation') || text.includes('not found')) {
    return `Match Scoring table missing. Supabase SQL Editor me database/add-match-scoring.sql run karo, phir 20 sec baad page refresh karo. Detail: ${rawMessage}`;
  }
  if (text.includes('row-level security') || text.includes('rls') || text.includes('42501')) {
    return 'Match scoring save permission blocked. Admin login check karo aur database/add-match-scoring.sql run karo.';
  }
  return error?.message || 'Scoring save failed. Please try again.';
}

async function uploadFile(bucket, file, folder) {
  if (!file) return null;
  const safeFolder = folder.replace(/[^a-zA-Z0-9-]/g, '-');
  const path = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });
  if (error) throw error;
  return path;
}

function getPublicPhotoUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(photoBucket).getPublicUrl(path);
  return data.publicUrl;
}

function filePreviewUrl(file) {
  if (!file || !file.type?.startsWith('image/')) return '';
  return URL.createObjectURL(file);
}

async function imageFileToCompressedDataUrl(file, maxWidth = 900, maxHeight = 1200, quality = 0.72) {
  if (!file) return null;
  if (!file.type?.startsWith('image/')) {
    throw new Error('Please upload image files only.');
  }

  const originalUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Selected image could not be read.'));
      img.src = originalUrl;
    });

    const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
}

async function imageFileToPassportDataUrl(file, crop = defaultPassportCrop) {
  if (!file) return null;
  if (!file.type?.startsWith('image/')) {
    throw new Error('Please upload image files only.');
  }

  const originalUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Selected image could not be read.'));
      img.src = originalUrl;
    });

    const frameWidth = passportPhotoWidth - passportPhotoPadding * 2;
    const frameHeight = passportPhotoHeight - passportPhotoPadding * 2;
    const area = crop?.croppedAreaPixels;
    let sourceX;
    let sourceY;
    let sourceWidth;
    let sourceHeight;

    if (area?.width && area?.height) {
      sourceX = area.x;
      sourceY = area.y;
      sourceWidth = area.width;
      sourceHeight = area.height;
    } else {
      const zoom = Math.min(2.5, Math.max(1, Number(crop.zoom) || 1));
      sourceWidth = image.width;
      sourceHeight = sourceWidth / passportAspectRatio;
      if (sourceHeight > image.height) {
        sourceHeight = image.height;
        sourceWidth = sourceHeight * passportAspectRatio;
      }
      sourceWidth /= zoom;
      sourceHeight /= zoom;
      sourceX = Math.max(0, (image.width - sourceWidth) / 2);
      sourceY = Math.max(0, (image.height - sourceHeight) / 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = passportPhotoWidth;
    canvas.height = passportPhotoHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = passportBackgroundColor;
    context.fillRect(0, 0, passportPhotoWidth, passportPhotoHeight);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, passportPhotoPadding, passportPhotoPadding, frameWidth, frameHeight);
    return canvas.toDataURL('image/jpeg', 0.64);
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
}

function formatSaveError(error) {
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  return friendlyUploadError(parts.join(' | '));
}

async function readGatePassword(configKey, fallbackPassword) {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', configKey)
      .maybeSingle();
    if (error) throw error;
    return String(data?.value?.value ?? data?.value ?? fallbackPassword);
  } catch {
    return fallbackPassword;
  }
}

async function saveGatePassword(configKey, nextPassword) {
  return supabase
    .from('app_config')
    .upsert(
      { key: configKey, value: { value: nextPassword }, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
}

function readAdminGatePassword() {
  return readGatePassword('admin_password', fixedAdminPassword);
}

function readSubAdminGatePassword() {
  return readGatePassword('subadmin_password', fixedSubAdminPassword);
}

function saveAdminGatePassword(nextPassword) {
  return saveGatePassword('admin_password', nextPassword);
}

function saveSubAdminGatePassword(nextPassword) {
  return saveGatePassword('subadmin_password', nextPassword);
}

function whatsappPhoneNumber(value) {
  const phone = numericText(value);
  if (phone.length === 10) return `91${phone}`;
  return phone;
}

function visitorCountFromConfig(value, fallback = 100) {
  const count = Number(value?.value ?? value);
  return Number.isFinite(count) && count >= 100 ? Math.trunc(count) : fallback;
}

async function readSharedVisitorCount() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', sharedVisitorCounterKey)
    .maybeSingle();
  if (error) throw error;
  return visitorCountFromConfig(data?.value);
}

async function incrementSharedVisitorCount() {
  const { data: rpcValue, error: rpcError } = await supabase.rpc('increment_visitor_count');
  if (!rpcError) return visitorCountFromConfig(rpcValue, 101);

  // Existing installs can increment safely before the optional RPC migration is applied.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: currentRow, error: readError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', sharedVisitorCounterKey)
      .maybeSingle();
    if (readError) throw readError;

    if (!currentRow) {
      const { data: insertedRow, error: insertError } = await supabase
        .from('app_config')
        .insert({ key: sharedVisitorCounterKey, value: { value: 101 }, updated_at: new Date().toISOString() })
        .select('value')
        .maybeSingle();
      if (!insertError && insertedRow) return visitorCountFromConfig(insertedRow.value, 101);
      continue;
    }

    const currentCount = visitorCountFromConfig(currentRow.value);
    const nextCount = currentCount + 1;
    const { data: updatedRow, error: updateError } = await supabase
      .from('app_config')
      .update({ value: { value: nextCount }, updated_at: new Date().toISOString() })
      .eq('key', sharedVisitorCounterKey)
      .contains('value', { value: currentCount })
      .select('value')
      .maybeSingle();
    if (updateError) throw updateError;
    if (updatedRow) return visitorCountFromConfig(updatedRow.value, nextCount);
  }

  return readSharedVisitorCount();
}

function whatsappSentMap(player) {
  const stats = parseStats(player?.stats);
  return stats.whatsapp_messages || {};
}

function playerPaidAmount(player) {
  return toNumber(playerMeta(player, 'paid_amount'));
}

function playerRequiredAmount(player) {
  return Math.max(0, toNumber(player?.base_price));
}

function playerDueAmount(player) {
  return Math.max(0, playerRequiredAmount(player) - playerPaidAmount(player));
}

function playerWhatsappMessage(player, type, settings) {
  const name = titleCase(player?.full_name || 'Player');
  const paidAmount = playerPaidAmount(player);
  const requiredAmount = playerRequiredAmount(player);
  const dueAmount = playerDueAmount(player);
  const currencyMode = settings?.currency_mode || 'Points';

  if (type === 'registration') {
    return `नमस्ते ${name} जी, आपका CPL Tournament में player registration सफल हो गया है. धन्यवाद.`;
  }
  if (type === 'paid') {
    return `नमस्ते ${name} जी, टूर्नामेंट की निर्धारित राशि ${formatMoney(requiredAmount, currencyMode)} पूरी जमा हो गई है। आपकी भुगतान पुष्टि सफल रही। धन्यवाद।`;
  }
  return `नमस्ते ${name} जी, आपकी जमा राशि ${formatMoney(paidAmount, currencyMode)} प्राप्त हुई है। टूर्नामेंट की निर्धारित राशि में से ${formatMoney(dueAmount, currencyMode)} शेष है। कृपया बाकी राशि जमा करें। धन्यवाद।`;
}

function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/demo') {
    return <DemoApp />;
  }
  return <MainApp />;
}

function createDemoData() {
  const demoTournament = {
    id: 9001,
    name: 'Demo Premier League 2026',
    start_date: '2026-09-22',
    end_date: '2026-09-30',
    auction_end_date: '2026-09-30',
    address: 'Demo Cricket Ground, Rajnandgaon',
    description: 'Read-only demo tournament for CPL Auction Software.'
  };
  const demoTeams = [
    { id: 1, team_name: 'VCK Club', owner_name: 'Owner 1', owner_mobile: '9000000001', total_budget: 100000, remaining_budget: 82000, max_players: 16 },
    { id: 2, team_name: 'Ramesh 11', owner_name: 'Owner 2', owner_mobile: '9000000002', total_budget: 100000, remaining_budget: 76000, max_players: 16 },
    { id: 3, team_name: 'NV 11', owner_name: 'Owner 3', owner_mobile: '9000000003', total_budget: 100000, remaining_budget: 90000, max_players: 16 },
    { id: 4, team_name: '11 Star Chikhali', owner_name: 'Owner 4', owner_mobile: '9000000004', total_budget: 100000, remaining_budget: 68000, max_players: 16 }
  ];
  const demoPlayers = [
    { id: 1, full_name: 'Demo All Rounder', mobile_number: '9999990001', photo_url: '/demo-players/demo-all-rounder.png', category: 'All-rounder', base_price: 1000, sold_status: 'Sold', assigned_team_id: 1, final_bid_price: 18000, stats: JSON.stringify({ player_criteria: 'Silver Player' }) },
    { id: 2, full_name: 'Demo Batsman', mobile_number: '9999990002', photo_url: '/demo-players/demo-batsman.png', category: 'Batsman', base_price: 1000, sold_status: 'Sold', assigned_team_id: 2, final_bid_price: 24000, stats: JSON.stringify({ player_criteria: 'Gold Player' }) },
    { id: 3, full_name: 'Demo Bowler', mobile_number: '9999990003', photo_url: '/demo-players/demo-bowler.png', category: 'Bowler', base_price: 1000, sold_status: 'Available', assigned_team_id: null, final_bid_price: 0, stats: JSON.stringify({ player_criteria: 'Bronze Player' }) },
    { id: 4, full_name: 'Demo Wicket Keeper', mobile_number: '9999990004', photo_url: '/demo-players/demo-wicket-keeper.png', category: 'Wicket Keeper', base_price: 1000, sold_status: 'Sold', assigned_team_id: 4, final_bid_price: 32000, stats: JSON.stringify({ player_criteria: 'Platinum Player' }) }
  ];
  const demoSettings = {
    team_count: demoTeams.length,
    currency_mode: 'Points',
    current_player_id: 3,
    current_bid_amount: 1000,
    current_highest_team_id: null
  };
  const demoWebsiteContent = mergeWebsiteContent({
    hero: {
      eyebrow: 'Demo Version',
      title: 'CPL Auction Software Demo',
      lead: 'Public website, match schedule, gallery, projector, and auction screens ka read-only demo.'
    },
    popup: { enabled: false, title: '', message: '', button_label: 'Register Now' },
    about: {
      eyebrow: 'Demo Access',
      title: 'Client ko safe demo dikhane ke liye',
      body: 'Is demo link me sample data dikhega. Login, registration, upload, aur database save disabled rakha gaya hai.'
    },
    contact: {
      title: 'CPL Demo Desk',
      address: demoTournament.address,
      phone_1: '9000000000',
      phone_2: '',
      email: 'demo@cpl-auction.local'
    },
    gallery: [
      { image_url: '/create-computer-logo.jpeg', title: 'CPL Demo', caption: 'Protected preview' }
    ],
    testimonials: [
      { name: 'Demo Owner', text: 'Auction room, purse, and team roster preview ek jagah milta hai.', image_url: '' },
      { name: 'Demo Admin', text: 'Pamphlet aur schedule auto data se ready hota hai.', image_url: '' },
      { name: 'Demo Player', text: 'Mobile view compact aur registration flow simple hai.', image_url: '' }
    ],
    pamphlet_draft: {
      tournamentName: demoTournament.name,
      subTitle: 'Tennis Ball Cricket Tournament',
      cupTitle: '30 Yard Cup 2026',
      venue: demoTournament.address,
      startDate: demoTournament.start_date,
      firstMatchTime: '07:00',
      matchGapMinutes: 30,
      perDayMatches: 1,
      sundayMatches: 2,
      playoffStartDate: '2026-09-28',
      playoffMatches: 3,
      playoffPerDayMatches: 2,
      entryFee: '2000',
      firstPrize: '7000',
      secondPrize: '3500',
      formatRules: '7 Over Match\n2 Bowler 2-2 Over\n3 Bowler 1-1 Over\nOnly 1 Match Per Day\nSunday 2 Matches\nUmpire Decision Final',
      awardLines: 'Man of the Match - 1000\nMatch of the Tournament - 1000\nBest Bowler - 500\nBest Batsman - 500\nBest Catch - 500',
      footerNote: 'Demo schedule only'
    }
  });

  return {
    tournaments: [demoTournament],
    tournament: demoTournament,
    settings: demoSettings,
    teams: demoTeams,
    players: demoPlayers,
    logs: [
      { id: 1, player_id: 1, team_id: 1, bid_amount: 18000, created_at: new Date().toISOString() },
      { id: 2, player_id: 2, team_id: 2, bid_amount: 24000, created_at: new Date().toISOString() }
    ],
    websiteContent: demoWebsiteContent
  };
}

function DemoNotice({ view, setView }) {
  return (
    <section className="panel form-panel demo-notice-panel">
      <p className="eyebrow">Demo Version</p>
      <h1>Read-only demo active hai</h1>
      <p>
        Is demo link par login, registration, upload, aur database save disabled hai.
        Client ko software ka preview dikhane ke liye sample data use ho raha hai.
      </p>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => setView('home')}>
          <ArrowLeft size={18} /> Demo Home
        </button>
        <button className="ghost-button" type="button" onClick={() => setView('projector')}>
          <MonitorUp size={18} /> Projector Preview
        </button>
      </div>
      <small>Current section: {view}</small>
    </section>
  );
}

function DemoApp() {
  const demoData = useMemo(() => createDemoData(), []);
  const [view, setView] = useState('home');
  const [message, setMessage] = useState('');
  const currentPlayer = demoData.players.find((player) => player.id === demoData.settings.current_player_id);
  const highestTeam = demoData.teams.find((team) => team.id === demoData.settings.current_highest_team_id);

  function showDemoNotice(nextView) {
    setMessage('Demo version read-only hai. Save/login disabled hai.');
    setView(nextView);
  }

  if (view === 'home') {
    return (
      <>
        <PlayerCriteriaDatalist />
        {message && <Toast message={message} onClose={() => setMessage('')} />}
        <PublicWebsite
          tournament={demoData.tournament}
          websiteContent={demoData.websiteContent}
          settings={demoData.settings}
          teams={demoData.teams}
          players={demoData.players}
          selectedTournamentId={demoData.tournament.id}
          setMessage={setMessage}
          setView={showDemoNotice}
          demoMode
          disableRegistration
        />
      </>
    );
  }

  return (
    <Shell
      view={view}
      setView={showDemoNotice}
      onBack={() => setView('home')}
      tournaments={demoData.tournaments}
      selectedTournamentId={demoData.tournament.id}
      selectTournament={() => setMessage('Demo version me tournament change disabled hai.')}
    >
      <PlayerCriteriaDatalist />
      {message && <Toast message={message} onClose={() => setMessage('')} />}
      {view === 'projector' ? (
        <ProjectorView
          teams={demoData.teams}
          settings={demoData.settings}
          currentPlayer={currentPlayer}
          highestTeam={highestTeam}
          logs={demoData.logs}
          auctionResult={null}
          players={demoData.players}
        />
      ) : (
        <DemoNotice view={view} setView={setView} />
      )}
    </Shell>
  );
}

function MainApp() {
  const [view, setView] = useState('home');
  const [viewHistory, setViewHistory] = useState([]);
  const [adminSession, setAdminSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(() => sessionStorage.getItem('cpl-admin-role') || 'admin');
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => {
    const saved = localStorage.getItem('cpl-selected-tournament-id');
    return saved ? Number(saved) : null;
  });
  const [playerSession, setPlayerSession] = useState(() => {
    const saved = sessionStorage.getItem('cpl-player-session');
    return saved ? JSON.parse(saved) : null;
  });
  const [ownerSession, setOwnerSession] = useState(() => {
    const saved = sessionStorage.getItem('cpl-owner-session');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({
    team_count: 8,
    currency_mode: 'Points',
    current_player_id: null,
    current_bid_amount: 0,
    current_highest_team_id: null
  });
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [ownerPasses, setOwnerPasses] = useState([]);
  const [websiteContent, setWebsiteContent] = useState(defaultWebsiteContent);
  const [auctionResult, setAuctionResult] = useState(null);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAdminSession(data.session);
      await checkAdmin(data.session);
      await loadTournamentsAndCurrentData();
      if (mounted) setLoading(false);
    }

    boot();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAdminSession(session);
      await checkAdmin(session);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !selectedTournamentId) return;

    const channel = supabase
      .channel('cpl-auction-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => loadTournamentsAndCurrentData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => loadTeams(selectedTournamentId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => loadPlayers(selectedTournamentId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_logs' }, () => loadLogs(selectedTournamentId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_passes' }, () => loadOwnerPasses(selectedTournamentId, settings.current_player_id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_settings' }, () => loadSettings(selectedTournamentId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_content' }, () => loadWebsiteContent(selectedTournamentId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => {
        loadTournamentsAndCurrentData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournamentId]);

  useEffect(() => {
    if (!hasSupabaseConfig || !selectedTournamentId) return;
    loadAll(selectedTournamentId);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId || !settings.current_player_id) {
      setOwnerPasses([]);
      return;
    }
    loadOwnerPasses(selectedTournamentId, settings.current_player_id);
  }, [selectedTournamentId, settings.current_player_id]);

  useEffect(() => {
    if (!auctionResult) return undefined;
    const timer = setTimeout(() => setAuctionResult(null), auctionResultDisplayMs);
    return () => clearTimeout(timer);
  }, [auctionResult]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [view]);

  async function checkAdmin(session) {
    if (!session?.user) {
      setIsAdmin(false);
      return;
    }
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const admin = Boolean(data && !error);
    setIsAdmin(admin);
  }

  async function loadTournamentsAndCurrentData() {
    const tournamentList = await loadTournaments();
    const activeTournamentId = await readAppConfigNumber('active_tournament_id');
    const selected = tournamentList.find((item) => item.id === activeTournamentId) || tournamentList[0];

    if (!selected) {
      setSelectedTournamentId(null);
      setSettings((current) => ({
        ...current,
        current_player_id: null,
        current_bid_amount: 0,
        current_highest_team_id: null
      }));
      setTeams([]);
      setPlayers([]);
      setLogs([]);
      setOwnerPasses([]);
      setWebsiteContent(defaultWebsiteContent);
      return;
    }

    setSelectedTournamentId(selected.id);
    localStorage.setItem('cpl-selected-tournament-id', String(selected.id));
    await loadAll(selected.id);
  }

  async function readAppConfigNumber(key) {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return null;
    return toNumber(data?.value?.value ?? data?.value, null);
  }

  async function writeAppConfig(key, value) {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key, value: { value }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    return error;
  }


  async function loadTournaments() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .order('start_date', { ascending: false });

    if (error) {
      setMessage(`Tournament table missing. Run database/add-tournament-management.sql in Supabase SQL Editor. Detail: ${error.message}`);
      return [];
    }

    setTournaments(data || []);
    return data || [];
  }

  function selectTournament(tournamentId) {
    const nextId = Number(tournamentId);
    setSelectedTournamentId(nextId);
    localStorage.setItem('cpl-selected-tournament-id', String(nextId));
    writeAppConfig('active_tournament_id', nextId);
    sessionStorage.removeItem('cpl-player-session');
    sessionStorage.removeItem('cpl-owner-session');
    setPlayerSession(null);
    setOwnerSession(null);
  }

  async function loadAll(tournamentId = selectedTournamentId) {
    if (!tournamentId) return;
    await Promise.all([
      loadSettings(tournamentId),
      loadTeams(tournamentId),
      loadPlayers(tournamentId),
      loadLogs(tournamentId),
      loadOwnerPasses(tournamentId),
      loadWebsiteContent(tournamentId)
    ]);
  }

  async function loadOwnerPasses(tournamentId = selectedTournamentId, playerId = settings.current_player_id) {
    if (!tournamentId || !playerId) {
      setOwnerPasses([]);
      return;
    }
    const { data, error } = await supabase
      .from('owner_passes')
      .select('*, teams(team_name)')
      .eq('tournament_id', tournamentId)
      .eq('player_id', playerId);
    if (!error) setOwnerPasses(data || []);
  }

  async function loadSettings(tournamentId = selectedTournamentId) {
    if (!tournamentId) return;
    const { data, error } = await supabase
      .from('tournament_settings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .single();
    if (!error && data) setSettings(data);
  }

  async function loadTeams(tournamentId = selectedTournamentId) {
    if (!tournamentId) return;
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('id', { ascending: true });
    if (!error) setTeams(data || []);
  }

  async function loadPlayers(tournamentId = selectedTournamentId) {
    if (!tournamentId) return;
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('id', { ascending: false });
    if (!error) setPlayers(data || []);
  }

  async function loadLogs(tournamentId = selectedTournamentId) {
    if (!tournamentId) return;
    const { data, error } = await supabase
      .from('auction_logs')
      .select('*, teams(team_name), players(full_name)')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setLogs(data || []);
  }

  async function loadWebsiteContent(tournamentId = selectedTournamentId) {
    if (!tournamentId) return;
    const { data, error } = await supabase
      .from('website_content')
      .select('content')
      .eq('tournament_id', tournamentId)
      .maybeSingle();

    if (!error && data?.content) {
      setWebsiteContent(mergeWebsiteContent(data.content));
      return;
    }
    const localContent = await readLocalWebsiteContent(tournamentId);
    setWebsiteContent(localContent || defaultWebsiteContent);
  }

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === settings.current_player_id),
    [players, settings.current_player_id]
  );
  const highestTeam = useMemo(
    () => teams.find((team) => team.id === settings.current_highest_team_id),
    [teams, settings.current_highest_team_id]
  );
  const ownerTeam = useMemo(
    () => teams.find((team) => team.id === ownerSession?.team_id) || ownerSession,
    [teams, ownerSession]
  );
  const playerProfile = useMemo(
    () => players.find((player) => player.id === playerSession?.id) || playerSession,
    [players, playerSession]
  );
  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) || null,
    [tournaments, selectedTournamentId]
  );

  function navigateView(nextView, options = {}) {
    const resolvedView = typeof nextView === 'function' ? nextView(view) : nextView;
    if (!resolvedView || resolvedView === view) return;
    if (!options.replace) {
      setViewHistory((history) => [...history, view].slice(-20));
    }
    setView(resolvedView);
  }

  function goBackView() {
    const previousView = viewHistory[viewHistory.length - 1] || 'home';
    setViewHistory((history) => history.slice(0, -1));
    setView(previousView);
  }

  if (!hasSupabaseConfig) {
    return <MissingConfig />;
  }

  if (loading) {
    return (
      <Shell view={view} setView={setView} adminSession={adminSession} playerSession={playerSession}>
        <div className="loading-panel">
          <Activity className="spin" />
          <p>Connecting to the auction room...</p>
        </div>
      </Shell>
    );
  }

  const logoutAdmin = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('cpl-admin-role');
    setAdminRole('admin');
    setIsAdmin(false);
    navigateView('home', { replace: true });
  };
  const logoutPlayer = () => {
    sessionStorage.removeItem('cpl-player-session');
    setPlayerSession(null);
    navigateView('home', { replace: true });
  };
  const logoutOwner = () => {
    sessionStorage.removeItem('cpl-owner-session');
    setOwnerSession(null);
    navigateView('home', { replace: true });
  };

  if (view === 'home') {
    return (
      <>
        <PlayerCriteriaDatalist />
        {message && <Toast message={message} onClose={() => setMessage('')} />}
        <PublicWebsite
          tournament={selectedTournament}
          websiteContent={websiteContent}
          settings={settings}
          teams={teams}
          players={players}
          selectedTournamentId={selectedTournamentId}
          setMessage={setMessage}
          setView={navigateView}
        />
      </>
    );
  }

  return (
    <Shell
      view={view}
      setView={navigateView}
      onBack={goBackView}
      adminSession={adminSession}
      playerSession={playerSession}
      ownerSession={ownerSession}
      tournaments={tournaments}
      selectedTournamentId={selectedTournamentId}
      selectTournament={selectTournament}
      logoutAdmin={logoutAdmin}
      logoutPlayer={logoutPlayer}
      logoutOwner={logoutOwner}
    >
      <PlayerCriteriaDatalist />
      {message && <Toast message={message} onClose={() => setMessage('')} />}

      {view === 'login' && (
        <LoginHub
          selectedTournamentId={selectedTournamentId}
          setMessage={setMessage}
          setView={navigateView}
          setPlayerSession={setPlayerSession}
          setOwnerSession={setOwnerSession}
          setAdminRole={setAdminRole}
        />
      )}

      {view === 'admin' && (
        adminSession && isAdmin ? (
          <AdminDashboard
            settings={settings}
            tournament={selectedTournament}
            tournaments={tournaments}
            selectedTournamentId={selectedTournamentId}
            selectTournament={selectTournament}
            loadTournamentsAndCurrentData={loadTournamentsAndCurrentData}
            teams={teams}
            players={players}
            logs={logs}
            currentPlayer={currentPlayer}
            highestTeam={highestTeam}
            websiteContent={websiteContent}
            setWebsiteContent={setWebsiteContent}
            setMessage={setMessage}
            loadAll={loadAll}
            setView={navigateView}
            auctionResult={auctionResult}
            setAuctionResult={setAuctionResult}
            adminRole={adminRole}
          />
        ) : (
          <LoginHub
            defaultTab="admin"
            selectedTournamentId={selectedTournamentId}
            setMessage={setMessage}
            setView={navigateView}
            setPlayerSession={setPlayerSession}
            setOwnerSession={setOwnerSession}
            setAdminRole={setAdminRole}
          />
        )
      )}

      {view === 'register' && (
        <PlayerRegistration
          players={players}
          settings={settings}
          tournament={selectedTournament}
          selectedTournamentId={selectedTournamentId}
          setMessage={setMessage}
        />
      )}

      {view === 'player' && (
        playerProfile ? (
          <PlayerDashboard
            player={playerProfile}
            teams={teams}
            settings={settings}
            logs={logs.filter((log) => log.player_id === playerProfile.id)}
            logout={() => {
              sessionStorage.removeItem('cpl-player-session');
              setPlayerSession(null);
            }}
          />
        ) : (
          <LoginHub
            defaultTab="player"
            setPlayerSession={setPlayerSession}
            selectedTournamentId={selectedTournamentId}
            setMessage={setMessage}
            setView={navigateView}
            setOwnerSession={setOwnerSession}
            setAdminRole={setAdminRole}
          />
        )
      )}

      {view === 'owner' && (
        ownerSession ? (
          <TeamOwnerDashboard
            ownerTeam={ownerTeam}
            settings={settings}
            teams={teams}
            players={players}
            logs={logs}
            currentPlayer={currentPlayer}
            highestTeam={highestTeam}
            ownerPasses={ownerPasses}
            selectedTournamentId={selectedTournamentId}
            ownerSession={ownerSession}
            setOwnerSession={setOwnerSession}
            setMessage={setMessage}
            loadAll={loadAll}
            logout={logoutOwner}
          />
        ) : (
          <LoginHub
            defaultTab="owner"
            selectedTournamentId={selectedTournamentId}
            setOwnerSession={setOwnerSession}
            setMessage={setMessage}
            setView={navigateView}
            setPlayerSession={setPlayerSession}
            setAdminRole={setAdminRole}
          />
        )
      )}

      {view === 'scoring' && (
        <MatchScoring
          tournament={selectedTournament}
          selectedTournamentId={selectedTournamentId}
          teams={teams}
          players={players}
          settings={settings}
          setMessage={setMessage}
          canEdit={adminSession && isAdmin}
        />
      )}

      {view === 'projector' && (
        <ProjectorView
          teams={teams}
          settings={settings}
          currentPlayer={currentPlayer}
          highestTeam={highestTeam}
          logs={logs}
          auctionResult={auctionResult}
          players={players}
        />
      )}
    </Shell>
  );
}

function Shell({
  children,
  view,
  setView,
  onBack,
  adminSession,
  playerSession,
  ownerSession,
  tournaments = [],
  selectedTournamentId,
  selectTournament,
  logoutAdmin,
  logoutPlayer,
  logoutOwner
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nav = [
    { key: 'home', label: 'Home', icon: Trophy },
    { key: 'login', label: 'Login', icon: KeyRound },
    adminSession && { key: 'admin', label: 'Admin', icon: Shield },
    playerSession && { key: 'player', label: 'Player', icon: User },
    ownerSession && { key: 'owner', label: 'Team Owner', icon: WalletCards },
    { key: 'scoring', label: 'Match Scoring', icon: Activity },
    { key: 'projector', label: 'Projector', icon: MonitorUp }
  ].filter(Boolean);

  return (
    <div className={classNames('app-shell', mobileMenuOpen && 'shell-mobile-menu-open')}>
      <div className="shell-mobile-topbar">
        <div className="brand compact">
          <BrandMonogram compact />
          <strong>CPL Auction</strong>
        </div>
        <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Open menu">
          {mobileMenuOpen ? <X size={26} /> : <Menu size={28} />}
        </button>
      </div>
      <aside className="sidebar">
        <div className="brand">
          <BrandMonogram />
          <div>
            <strong>Cricket Players League</strong>
            <small>Live auction control</small>
          </div>
        </div>

        <nav className="nav-list" aria-label="Auction views">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={classNames('nav-button', view === item.key && 'active')}
                onClick={() => {
                  setView(item.key);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {tournaments.length > 0 && (
          <label className="sidebar-select">
            Tournament
            <select value={selectedTournamentId || ''} onChange={(e) => selectTournament?.(e.target.value)}>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="session-card">
          <span className="status-dot" />
          <div>
            <strong>{adminSession ? 'Admin signed in' : playerSession ? 'Player signed in' : ownerSession ? 'Owner signed in' : 'Public access'}</strong>
            <small>Realtime enabled</small>
          </div>
        </div>

        {adminSession && (
          <button className="ghost-button" onClick={logoutAdmin}>
            <LogOut size={17} /> Admin logout
          </button>
        )}
        {playerSession && (
          <button className="ghost-button" onClick={logoutPlayer}>
            <LogOut size={17} /> Player logout
          </button>
        )}
        {ownerSession && (
          <button className="ghost-button" onClick={logoutOwner}>
            <LogOut size={17} /> Owner logout
          </button>
        )}
      </aside>

      <main className="content">
        {onBack && view !== 'home' && (
          <button type="button" className="back-button" onClick={onBack} aria-label="Go back">
            <ArrowLeft size={18} />
            Back
          </button>
        )}
        {children}
      </main>
    </div>
  );
}

function PublicWebsite({
  tournament,
  websiteContent,
  settings,
  teams,
  players,
  selectedTournamentId,
  setMessage,
  setView,
  demoMode = false,
  disableRegistration = false
}) {
  const content = mergeWebsiteContent(websiteContent);
  const [popupClosed, setPopupClosed] = useState(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [gallerySlideIndex, setGallerySlideIndex] = useState(0);
  const [testimonialSlideIndex, setTestimonialSlideIndex] = useState(0);
  const [visitorCountValue, setVisitorCountValue] = useState(100);
  const [selectedPublicTeamId, setSelectedPublicTeamId] = useState(null);
  const [activeHash, setActiveHash] = useState(() => window.location.hash.replace('#', ''));
  const [registrationFocused, setRegistrationFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const featuredPlayers = players.filter((player) => playerMeta(player, 'photo_url') || player.photo_url).slice(0, 6);
  const soldPlayers = players.filter((player) => player.sold_status === 'Sold').length;
  const displayTeamCount = selectedTournamentId ? teams.length : 0;
  const galleryItems = content.gallery.filter((item) => item.image_url || item.title || item.caption);
  const gallerySlides = players.map((player) => ({
    image_url: playerMeta(player, 'photo_url') || player.photo_url,
    title: player.full_name,
    caption: player.category || 'Player'
  }));
  const galleryPageSize = 8;
  const galleryPages = Array.from(
    { length: Math.ceil(gallerySlides.length / galleryPageSize) },
    (_, pageIndex) => gallerySlides.slice(pageIndex * galleryPageSize, pageIndex * galleryPageSize + galleryPageSize)
  );
  const testimonialItems = content.testimonials.filter((item) => item.name || item.text || item.image_url);
  const contactPhone = numericText(content.contact.phone_1 || content.contact.phone_2 || '');
  const whatsappPhone = contactPhone.length === 10 ? `91${contactPhone}` : contactPhone;
  const visitorCount = String(visitorCountValue).padStart(3, '0').split('');
  const heroSlides = galleryItems.length
    ? galleryItems.filter((item) => item.image_url).map((item) => ({
      image_url: item.image_url,
      title: item.title || 'CPL Gallery',
      caption: item.caption || 'Tournament moment'
    }))
    : featuredPlayers.map((player) => ({
      image_url: playerMeta(player, 'photo_url') || player.photo_url,
      title: player.full_name,
      caption: player.category || 'Registered Player'
  }));
  const activeHeroSlide = heroSlides[heroSlideIndex % Math.max(1, heroSlides.length)];
  const activeGalleryPage = galleryPages[gallerySlideIndex % Math.max(1, galleryPages.length)] || [];
  const selectedPublicTeam = teams.find((team) => team.id === selectedPublicTeamId);
  const selectedPublicRoster = selectedPublicTeam
    ? players.filter((player) => player.sold_status === 'Sold' && player.assigned_team_id === selectedPublicTeam.id)
    : [];
  const testimonialOffsets = testimonialItems.length > 2 ? [-1, 0, 1] : testimonialItems.length === 2 ? [0, 1] : [0];
  const visibleTestimonials = testimonialItems.length
    ? testimonialOffsets.map((offset) => {
      const index = (testimonialSlideIndex + offset + testimonialItems.length) % testimonialItems.length;
      return {
        item: testimonialItems[index],
        index,
        active: offset === 0,
        position: offset < 0 ? 'left' : offset > 0 ? 'right' : 'center'
      };
    })
    : [];
  const registrationClosed = isAuctionRegistrationClosed(tournament);
  const registrationLocked = disableRegistration || registrationClosed;
  const registrationRequested = activeHash === 'registration' || registrationFocused;
  const showRegistrationSection = !registrationLocked && registrationRequested;
  const showRegistrationClosedNotice = registrationLocked && activeHash === 'registration';
  const registrationMobileMode = showRegistrationSection;

  useEffect(() => {
    let cancelled = false;

    async function syncVisitorCount() {
      if (!hasSupabaseConfig) return;
      try {
        const alreadyCounted = sessionStorage.getItem(sharedVisitorSessionKey) === 'yes';
        const nextCount = alreadyCounted
          ? await readSharedVisitorCount()
          : await incrementSharedVisitorCount();
        if (!alreadyCounted) sessionStorage.setItem(sharedVisitorSessionKey, 'yes');
        if (!cancelled) setVisitorCountValue(nextCount);
      } catch {
        if (!cancelled) setVisitorCountValue(100);
      }
    }

    syncVisitorCount();
    if (!hasSupabaseConfig) return () => { cancelled = true; };

    const visitorChannel = supabase
      .channel(`public-visitor-count-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: `key=eq.${sharedVisitorCounterKey}` },
        (payload) => {
          const nextCount = visitorCountFromConfig(payload.new?.value, visitorCountValue);
          if (!cancelled) setVisitorCountValue(nextCount);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(visitorChannel);
    };
  }, []);

  useEffect(() => {
    function updateHash() {
      const nextHash = window.location.hash.replace('#', '');
      setActiveHash(nextHash);
      if (nextHash === 'registration' && window.matchMedia('(max-width: 680px)').matches) {
        window.setTimeout(() => {
          document.getElementById('registration')?.scrollIntoView({ block: 'start' });
        }, 0);
      }
    }

    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  useEffect(() => {
    if (heroSlideIndex >= heroSlides.length) setHeroSlideIndex(0);
  }, [heroSlideIndex, heroSlides.length]);

  useEffect(() => {
    if (gallerySlideIndex >= galleryPages.length) setGallerySlideIndex(0);
  }, [gallerySlideIndex, galleryPages.length]);

  useEffect(() => {
    if (testimonialSlideIndex >= testimonialItems.length) setTestimonialSlideIndex(0);
  }, [testimonialSlideIndex, testimonialItems.length]);

  useEffect(() => {
    if (selectedPublicTeamId && !teams.some((team) => team.id === selectedPublicTeamId)) {
      setSelectedPublicTeamId(null);
    }
  }, [selectedPublicTeamId, teams]);

  useEffect(() => {
    if (heroSlides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    if (galleryPages.length <= 1) return undefined;
    const timer = setInterval(() => {
      setGallerySlideIndex((current) => (current + 1) % galleryPages.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [galleryPages.length]);

  useEffect(() => {
    if (testimonialItems.length <= 1) return undefined;
    const timer = setInterval(() => {
      setTestimonialSlideIndex((current) => (current + 1) % testimonialItems.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [testimonialItems.length]);

  useEffect(() => {
    function blockPublicShortcuts(event) {
      const key = String(event.key || '').toLowerCase();
      const protectedShortcut = (event.ctrlKey || event.metaKey) && ['c', 's', 'u', 'p'].includes(key);
      if (protectedShortcut || key === 'f12') {
        event.preventDefault();
        setMessage('Protected preview: copy, save, print, and source shortcuts disabled.');
      }
    }

    document.addEventListener('keydown', blockPublicShortcuts);
    return () => document.removeEventListener('keydown', blockPublicShortcuts);
  }, [setMessage]);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function closeRegistrationAfterSave() {
    setRegistrationFocused(false);
    setActiveHash('');
    if (window.location.hash === '#registration') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    window.setTimeout(() => {
      document.getElementById('home')?.scrollIntoView({ block: 'start' });
    }, 0);
  }

  function blockClosedRegistration(event) {
    event.preventDefault();
    setPopupClosed(true);
    setMessage(disableRegistration
      ? 'Demo version me registration/save disabled hai.'
      : `Auction registration closed${tournament?.auction_end_date ? ` on ${formatDate(tournament.auction_end_date)}` : ''}.`);
  }

  return (
    <div
      className={classNames(
        'public-site',
        'protected-content',
        demoMode && 'demo-mode',
        registrationMobileMode && 'registration-mobile-mode',
        mobileMenuOpen && 'mobile-menu-open'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        setMessage('Protected preview: right click disabled.');
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      {demoMode && <div className="demo-banner">DEMO VERSION - Read only preview, data save disabled</div>}
      <div className="public-protection-watermark" aria-hidden="true">CPL Auction Software</div>
      {content.popup.enabled && !popupClosed && (
        <div className="site-popup" role="dialog" aria-modal="true">
          <div className="site-popup-card">
            <button className="popup-close" onClick={() => setPopupClosed(true)} aria-label="Close popup">x</button>
            <p className="eyebrow">Announcement</p>
            <h2>{content.popup.title}</h2>
            <p>{content.popup.message}</p>
            {registrationLocked ? (
              <button className="primary-button inline" type="button" onClick={blockClosedRegistration}>
                <UserPlus size={18} /> {disableRegistration ? 'Demo Locked' : 'Registration Closed'}
              </button>
            ) : (
              <a className="primary-button inline" href="#registration" onClick={() => setPopupClosed(true)}>
                <UserPlus size={18} /> {content.popup.button_label || 'Register Now'}
              </a>
            )}
          </div>
        </div>
      )}
      <header className="public-nav">
        <a className="public-brand" href="#home">
          <BrandMonogram compact />
          <strong>Players Auction System</strong>
        </a>
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={26} /> : <Menu size={28} />}
        </button>
        <div className="public-menu-panel">
          <nav>
            <a href="#home" onClick={closeMobileMenu}>Home</a>
            <a href="#about" onClick={closeMobileMenu}>About</a>
            <a href="#match-schedule" onClick={closeMobileMenu}>Match Schedule</a>
            <a href="#photos" onClick={closeMobileMenu}>Photos</a>
            <a href="#contact" onClick={closeMobileMenu}>Contact</a>
            <button type="button" onClick={() => { closeMobileMenu(); setView('scoring'); }}>Match Scoring</button>
          </nav>
          <div className="public-actions">
            <button className="primary-button small" onClick={() => { closeMobileMenu(); setView('login'); }}>
              <KeyRound size={15} /> Login
            </button>
          </div>
        </div>
      </header>

      <main id="home">
        <section className="home-hero">
          {activeHeroSlide?.image_url && (
            <div className="hero-background-slider" key={`${activeHeroSlide.title}-${heroSlideIndex}`}>
              <img src={activeHeroSlide.image_url} alt="" aria-hidden="true" />
            </div>
          )}
          <div className="hero-bg-overlay" />
          <div className="hero-copy">
            <div className="score-chip">
              <Trophy size={18} /> Live Auction
            </div>
            <p className="eyebrow">{content.hero.eyebrow}</p>
            <h1>{content.hero.title || tournament?.name || 'CPL Player Auction'}</h1>
            <p className="hero-lead">
              {content.hero.lead}
            </p>
            <div className="hero-photo-caption">
              <strong>{activeHeroSlide?.title || 'Next Star Player'}</strong>
              <span>{activeHeroSlide?.caption || 'Registration Open'}</span>
            </div>
            <div className="hero-cta-row">
              <a className="hero-button read-more" href="#about">Read More</a>
            </div>
            <div className="hero-stats">
              <Metric label="Teams" value={displayTeamCount} />
              <Metric label="Registered" value={selectedTournamentId ? players.length : 0} />
              <Metric label="Sold Players" value={selectedTournamentId ? soldPlayers : 0} />
            </div>
            <div className="home-team-strip">
              <strong>Teams</strong>
              <div>
                {teams.length ? (
                  teams.map((team) => (
                    <button
                      type="button"
                      key={team.id}
                      className={classNames(selectedPublicTeamId === team.id && 'active')}
                      onClick={() => setSelectedPublicTeamId(selectedPublicTeamId === team.id ? null : team.id)}
                    >
                      {team.team_name}
                    </button>
                  ))
                ) : (
                  <span>Teams will appear here</span>
                )}
              </div>
              {selectedPublicTeam && (
                <div className="home-team-roster">
                  <h3>{selectedPublicTeam.team_name} Sold Players</h3>
                  {selectedPublicRoster.length ? (
                    selectedPublicRoster.map((player) => (
                      <span key={player.id}>
                        {player.full_name} - {formatMoney(soldPlayerPrice(player), settings.currency_mode)}
                      </span>
                    ))
                  ) : (
                    <small>Is team me abhi koi sold player nahi hai.</small>
                  )}
                </div>
              )}
            </div>
            {heroSlides.length > 1 && (
              <div className="slider-dots hero-dots" aria-label="Photo slider dots">
                {heroSlides.map((slide, index) => (
                  <button
                    key={`${slide.title}-${index}`}
                    className={classNames(index === heroSlideIndex && 'active')}
                    onClick={() => setHeroSlideIndex(index)}
                    aria-label={`Show slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {showRegistrationSection && (
          <section
            id="registration"
            className="home-section homepage-register"
            onFocusCapture={() => setRegistrationFocused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setRegistrationFocused(false);
            }}
          >
            <div className="section-heading">
              <p className="eyebrow">New Players Registration</p>
              <h2>Player Registration Form</h2>
            </div>
            <PlayerRegistration
              players={players}
              settings={settings}
              tournament={tournament}
              selectedTournamentId={selectedTournamentId}
              setMessage={setMessage}
              paymentQrUrl={content.payment_qr_url}
              showHeader={false}
              showTable={false}
              onSaved={closeRegistrationAfterSave}
            />
          </section>
        )}

        {showRegistrationClosedNotice && (
          <section id="registration" className="home-section homepage-register">
            <div className="section-heading">
              <p className="eyebrow">{disableRegistration ? 'Demo Locked' : 'Registration Closed'}</p>
              <h2>{disableRegistration ? 'Demo version me registration disabled hai' : 'Auction registration closed'}</h2>
              <p className="empty-text">
                {disableRegistration
                  ? 'Ye demo client ko preview dikhane ke liye hai. Isme player save ya upload nahi hoga.'
                  : tournament?.auction_end_date
                  ? `Registration ${formatDate(tournament.auction_end_date)} ke baad closed hai.`
                  : 'Registration abhi closed hai.'}
              </p>
            </div>
          </section>
        )}

        <section id="about" className="home-section about-grid">
          <div>
            <p className="eyebrow">{content.about.eyebrow}</p>
            <h2>{content.about.title}</h2>
            <p>
              {content.about.body}
            </p>
          </div>
          <div className="about-cards">
            <button type="button" onClick={() => setView('login')}><Gavel size={24} /><strong>Live Bidding</strong><span>Realtime auction updates</span></button>
            <article><WalletCards size={24} /><strong>Purse Control</strong><span>Budget validation built in</span></article>
            <button type="button" onClick={() => setView('projector')}><MonitorUp size={24} /><strong>Projector View</strong><span>Clean public display</span></button>
          </div>
        </section>

        <section id="match-schedule" className="home-section public-pamphlet-section">
          <div className="section-heading">
            <p className="eyebrow">Match Schedule</p>
            <h2>Tournament Pamphlet</h2>
          </div>
          <TournamentPamphlet
            tournament={tournament}
            settings={settings}
            teams={teams}
            players={players}
            editable={false}
            showPrintButton={false}
            savedDraft={content.pamphlet_draft}
          />
        </section>

        <section id="photos" className="home-section">
          <div className="section-heading">
            <p className="eyebrow">Photos</p>
            <h2>Registered Player Gallery</h2>
          </div>
          <div className="section-slider">
            {activeGalleryPage.length ? (
              <div className="player-gallery-grid" key={`gallery-page-${gallerySlideIndex}`}>
                {activeGalleryPage.map((player, index) => (
                  <article className="player-gallery-tile" key={`${player.title}-${gallerySlideIndex}-${index}`}>
                    {player.image_url ? (
                      <img src={player.image_url} alt={`${player.title || 'Player'} photo`} />
                    ) : (
                      <span className="gallery-photo-fallback">{player.title?.[0] || 'P'}</span>
                    )}
                    <div>
                      <strong>{player.title || 'Player Name'}</strong>
                      <span>{player.caption || 'Player'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <article className="gallery-card empty-gallery">
                <Camera size={42} />
                <strong>Player photos will appear here</strong>
                <span>Registration form se player save karte hi gallery update hogi.</span>
              </article>
            )}
            {galleryPages.length > 1 && (
              <div className="slider-dots section-dots" aria-label="Gallery slider dots">
                {galleryPages.map((page, index) => (
                  <button
                    key={`gallery-page-dot-${index}`}
                    className={classNames(index === gallerySlideIndex && 'active')}
                    onClick={() => setGallerySlideIndex(index)}
                    aria-label={`Show gallery page ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="home-section testimonials">
          <div className="testimonial-heading">
            <p className="eyebrow lined">Testimonial</p>
            <h2>Our Players Say!</h2>
          </div>
          <div className="testimonial-slider modern-testimonial-slider">
            <div className={classNames('testimonial-track', `items-${visibleTestimonials.length}`)}>
              {visibleTestimonials.map(({ item, index, active, position }) => (
                <article
                  className={classNames('testimonial-modern-card', active ? 'active' : 'side', position)}
                  key={`${item.name}-${index}-${position}`}
                >
                  {item.image_url ? (
                    <img className="testimonial-photo" src={item.image_url} alt={`${item.name || 'CPL'} testimonial`} />
                  ) : (
                    <span className="testimonial-photo fallback">{item.name?.[0] || 'C'}</span>
                  )}
                  <strong>{item.name || 'CPL Member'}</strong>
                  <p>{item.text || 'Great auction experience.'}</p>
                </article>
              ))}
              {!visibleTestimonials.length && (
                <article className="testimonial-modern-card active center">
                  <span className="testimonial-photo fallback">C</span>
                  <strong>CPL Member</strong>
                  <p>Great auction experience.</p>
                </article>
              )}
            </div>
            {testimonialItems.length > 1 && (
              <div className="slider-dots testimonial-dots" aria-label="Testimonial slider dots">
                {testimonialItems.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    className={classNames(index === testimonialSlideIndex && 'active')}
                    onClick={() => setTestimonialSlideIndex(index)}
                    aria-label={`Show testimonial ${index + 1}`}
                  />
                ))}
              </div>
            )}
            <div className="stars testimonial-stars" aria-hidden="true">
              <Star size={16} /><Star size={16} /><Star size={16} /><Star size={16} /><Star size={16} />
            </div>
          </div>
        </section>

        <section id="contact" className="home-section contact-grid">
          <div>
            <p className="eyebrow">Address</p>
            <h2>{content.contact.address || tournament?.address || 'Tournament venue will be updated soon'}</h2>
            <p>{tournament?.description || 'Register your players and follow the official auction updates from this website.'}</p>
          </div>
          <div className="contact-card">
            <MapPin size={22} />
            <strong>{content.contact.title || 'CPL Auction Desk'}</strong>
            <span>{content.contact.address || tournament?.address || 'Venue details pending'}</span>
            <span><Phone size={16} /> {content.contact.phone_1 || 'Contact number can be added by organiser'}</span>
            {content.contact.phone_2 && <span><Phone size={16} /> {content.contact.phone_2}</span>}
            <span><Mail size={16} /> {content.contact.email || 'Official updates through admin panel'}</span>
          </div>
        </section>

        <div className="floating-site-actions" aria-label="Quick contact actions">
          <a className="whatsapp-float" href={whatsappPhone ? `https://wa.me/${whatsappPhone}` : '#contact'} aria-label="Open WhatsApp">
            WA
          </a>
          <a className="back-to-top" href="#home" aria-label="Back to top">↑</a>
        </div>

        <footer className="site-footer">
          <div className="footer-grid">
            <section>
              <h3>Quick Link</h3>
              <nav className="footer-links">
                <a href="#about"><span>›</span> About Us</a>
                <a href="#photos"><span>›</span> Gallery</a>
                <a href="#contact"><span>›</span> Contact Us</a>
                <button type="button" onClick={() => setView('login')}><span>›</span> Login</button>
              </nav>
            </section>

            <section>
              <h3>Contact</h3>
              <div className="footer-contact">
                <p><MapPin size={17} /> <span>{content.contact.address || tournament?.address || 'Venue details pending'}</span></p>
                <p><Phone size={17} /> <span>{content.contact.phone_1 || 'Contact number can be added by organiser'}</span></p>
                {content.contact.phone_2 && <p><Phone size={17} /> <span>{content.contact.phone_2}</span></p>}
                <p><Mail size={17} /> <span>{content.contact.email || 'Official updates through admin panel'}</span></p>
              </div>
              <div className="footer-socials" aria-label="Social links">
                <a href="#home" aria-label="CPL social">C</a>
                <a href="#photos" aria-label="Gallery social">G</a>
                {content.popup.enabled && !registrationLocked && <a href="#registration" aria-label="Registration social">R</a>}
                <a href="#contact" aria-label="Contact social">@</a>
              </div>
            </section>

            <section>
              <h3>Auction Application</h3>
              <p className="footer-app-copy">Live auction, player registration, team purse, and projector display are available in this CPL system.</p>
              {content.popup.enabled && !registrationLocked && <a className="footer-app-badge" href="#registration">Open CPL Auction</a>}
              <div className="visitor-count">
                <strong>Visitor Count .</strong>
                <span>{visitorCount.map((digit, index) => <b key={`${digit}-${index}`}>{digit}</b>)}</span>
              </div>
            </section>
          </div>
          <div className="footer-bottom">
            <span>© 2026 <strong>Create Computer, Rajnandgaon, 7000492856</strong> All Right Reserved.</span>
            <div className="footer-developer">
              <span>Developed By</span>
              <div className="footer-developer-brand">
                <img src="/create-computer-logo.jpeg" alt="Create Computer logo" />
                <strong>Create Computer</strong>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function MissingConfig() {
  return (
    <div className="config-screen">
      <div className="config-panel">
        <Gavel size={42} />
        <h1>Supabase credentials needed</h1>
        <p>Create a `.env` file from `.env.example`, paste your project URL and anon public key, then restart the dev server.</p>
        <pre>{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key`}</pre>
      </div>
    </div>
  );
}

function LoginHub({
  defaultTab = 'player',
  selectedTournamentId,
  setMessage,
  setView,
  setPlayerSession,
  setOwnerSession,
  setAdminRole
}) {
  const [tab, setTab] = useState(defaultTab);
  const tabs = [
    { key: 'player', label: 'Player', icon: User },
    { key: 'owner', label: 'Owner', icon: WalletCards },
    { key: 'admin', label: 'Admin', icon: Shield }
  ];

  return (
    <section className="login-hub">
      <div className="panel form-panel login-card">
        <div className="section-title">
          <KeyRound size={22} />
          <h1>Login</h1>
        </div>
        <div className="segmented full-segment login-tabs">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.key}
                className={classNames(tab === item.key && 'active')}
                onClick={() => setTab(item.key)}
              >
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'player' && (
          <PlayerLogin
            compact
            selectedTournamentId={selectedTournamentId}
            setMessage={setMessage}
            setPlayerSession={setPlayerSession}
            onSuccess={() => setView('player')}
          />
        )}
        {tab === 'owner' && (
          <TeamOwnerLogin
            compact
            selectedTournamentId={selectedTournamentId}
            setMessage={setMessage}
            setOwnerSession={setOwnerSession}
            onSuccess={() => setView('owner')}
          />
        )}
        {tab === 'admin' && (
          <AdminLogin
            compact
            setMessage={setMessage}
            onSuccess={(role) => {
              sessionStorage.setItem('cpl-admin-role', role);
              setAdminRole?.(role);
              setView('admin');
            }}
          />
        )}
      </div>
    </section>
  );
}

function AdminLogin({ setMessage, onSuccess, compact = false }) {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const loginId = adminId.trim().toLowerCase();
    setBusy(true);
    const roleConfig = loginId === fixedAdminId
      ? { role: 'admin', savedPassword: await readAdminGatePassword() }
      : loginId === fixedSubAdminId
        ? { role: 'subadmin', savedPassword: await readSubAdminGatePassword() }
        : null;
    if (!roleConfig || password !== roleConfig.savedPassword) {
      setBusy(false);
      setMessage('Invalid admin ID or password.');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: fixedAdminEmail,
      password: fixedAdminPassword
    });
    setBusy(false);
    if (error) {
      setMessage(`Supabase admin user not ready: create ${fixedAdminEmail} with password ${fixedAdminPassword}.`);
      return;
    }

    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', data.session.user.id)
      .maybeSingle();

    if (!adminUser || adminError) {
      await supabase.auth.signOut();
      setMessage(`Add ${fixedAdminEmail} to the admin_users table before logging in.`);
      return;
    }
    onSuccess?.(roleConfig.role);
  }

  const form = (
    <form className="panel form-panel login-form-panel" onSubmit={submit}>
      <label>
        Admin / Sub Admin ID
        <input type="text" value={adminId} onChange={(e) => setAdminId(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button className="primary-button" disabled={busy}>
        <Shield size={18} />
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );

  if (compact) return form;

  return (
    <section className="auth-grid">
      <div className="auth-copy">
        <Shield size={34} />
        <h1>Admin auction console</h1>
        <p>Sign in with admin or subadmin ID to configure teams, import players, and control live bidding.</p>
      </div>
      {form}
    </section>
  );
}

function AdminPasswordAdmin({ setMessage }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPasswordForSubAdmin, setAdminPasswordForSubAdmin] = useState('');
  const [nextSubAdminPassword, setNextSubAdminPassword] = useState('');
  const [confirmSubAdminPassword, setConfirmSubAdminPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [subAdminBusy, setSubAdminBusy] = useState(false);

  async function submitAdminPassword(event) {
    event.preventDefault();
    const current = currentPassword.trim();
    const next = nextPassword.trim();
    const confirm = confirmPassword.trim();

    if (next.length < 5) {
      setMessage('New admin password kam se kam 5 characters ka rakho.');
      return;
    }
    if (next !== confirm) {
      setMessage('New password aur confirm password match nahi ho raha.');
      return;
    }

    setBusy(true);
    const savedPassword = await readAdminGatePassword();
    if (current !== savedPassword) {
      setBusy(false);
      setMessage('Current admin password galat hai.');
      return;
    }

    const { error } = await saveAdminGatePassword(next);
    setBusy(false);
    if (error) {
      setMessage(`Admin password save nahi hua. Supabase SQL me database/add-global-config-and-owner-pass.sql run karo. Detail: ${error.message}`);
      return;
    }

    setCurrentPassword('');
    setNextPassword('');
    setConfirmPassword('');
    setMessage('Admin password changed. Next login me naya password use hoga.');
  }

  async function submitSubAdminPassword(event) {
    event.preventDefault();
    const adminPassword = adminPasswordForSubAdmin.trim();
    const next = nextSubAdminPassword.trim();
    const confirm = confirmSubAdminPassword.trim();

    if (next.length < 5) {
      setMessage('Sub Admin password kam se kam 5 characters ka rakho.');
      return;
    }
    if (next !== confirm) {
      setMessage('Sub Admin password aur confirm password match nahi ho raha.');
      return;
    }

    setSubAdminBusy(true);
    const savedAdminPassword = await readAdminGatePassword();
    if (adminPassword !== savedAdminPassword) {
      setSubAdminBusy(false);
      setMessage('Admin password galat hai. Sub Admin password change nahi hua.');
      return;
    }

    const { error } = await saveSubAdminGatePassword(next);
    setSubAdminBusy(false);
    if (error) {
      setMessage(`Sub Admin password save nahi hua. Supabase SQL setup check karo. Detail: ${error.message}`);
      return;
    }

    setAdminPasswordForSubAdmin('');
    setNextSubAdminPassword('');
    setConfirmSubAdminPassword('');
    setMessage('Sub Admin password changed. Sub Admin next login me naya password use karega.');
  }

  return (
    <div className="stack">
      <section className="panel form-panel admin-security-panel">
        <div className="section-title">
          <Shield size={22} />
          <h2>Change Admin Password</h2>
        </div>
        <p className="empty-text">
          Admin ID same rahega: <strong>{fixedAdminId}</strong>. Password change karne ke baad next login me naya password lagega.
        </p>
        <form className="nested-form" onSubmit={submitAdminPassword}>
          <label>
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="new-password"
              minLength="5"
              required
            />
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength="5"
              required
            />
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={busy}>
              <Save size={18} /> {busy ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel form-panel admin-security-panel">
        <div className="section-title">
          <Users size={22} />
          <h2>Sub Admin Password</h2>
        </div>
        <p className="empty-text">
          Sub Admin ID: <strong>{fixedSubAdminId}</strong>. Default password: <strong>{fixedSubAdminPassword}</strong>.
          Sub Admin ko admin jaise controls milenge, lekin Password tab nahi dikhega.
        </p>
        <form className="nested-form" onSubmit={submitSubAdminPassword}>
          <label>
            Admin Password
            <input
              type="password"
              value={adminPasswordForSubAdmin}
              onChange={(event) => setAdminPasswordForSubAdmin(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New Sub Admin Password
            <input
              type="password"
              value={nextSubAdminPassword}
              onChange={(event) => setNextSubAdminPassword(event.target.value)}
              autoComplete="new-password"
              minLength="5"
              required
            />
          </label>
          <label>
            Confirm Sub Admin Password
            <input
              type="password"
              value={confirmSubAdminPassword}
              onChange={(event) => setConfirmSubAdminPassword(event.target.value)}
              autoComplete="new-password"
              minLength="5"
              required
            />
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={subAdminBusy}>
              <Save size={18} /> {subAdminBusy ? 'Saving...' : 'Save Sub Admin Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PlayerLogin({ setPlayerSession, selectedTournamentId, setMessage, onSuccess, compact = false }) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!selectedTournamentId) return setMessage('Select a tournament before player login.');
    setBusy(true);
    const { data, error } = await supabase.rpc('player_login', {
      phone: digitsOnly(mobile),
      password: password.trim().toLowerCase(),
      selected_tournament_id: selectedTournamentId
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const player = data?.[0];
    if (!player) {
      setMessage('No matching player found. Use your 10-digit mobile number and first name.');
      return;
    }

    sessionStorage.setItem('cpl-player-session', JSON.stringify(player));
    setPlayerSession(player);
    onSuccess?.();
  }

  const form = (
    <form className="panel form-panel login-form-panel" onSubmit={submit}>
      <label>
        Mobile Number
        <input
          inputMode="numeric"
          maxLength="10"
          value={mobile}
          onChange={(e) => setMobile(digitsOnly(e.target.value))}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="First word of name"
          required
        />
      </label>
      <button className="primary-button" disabled={busy || mobile.length !== 10}>
        <User size={18} />
        {busy ? 'Checking...' : 'Enter dashboard'}
      </button>
    </form>
  );

  if (compact) return form;

  return (
    <section className="auth-grid">
      <div className="auth-copy player-copy">
        <User size={34} />
        <h1>Player dashboard</h1>
        <p>Players sign in with mobile number and the first word of their registered name. Status updates arrive live during the auction.</p>
      </div>
      {form}
    </section>
  );
}

function TeamOwnerLogin({ selectedTournamentId, setOwnerSession, setMessage, onSuccess, compact = false }) {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!selectedTournamentId) return setMessage('Owner login se pehle tournament select karo.');
    const phone = digitsOnly(mobile);
    if (phone.length !== 10) return setMessage('Owner mobile number 10 digit hona chahiye.');
    if (!pin.trim()) return setMessage('Owner PIN enter karo.');

    setBusy(true);
    const { data, error } = await supabase.rpc('team_owner_login', {
      phone,
      pin: pin.trim(),
      selected_tournament_id: selectedTournamentId
    });
    setBusy(false);

    if (error) {
      setMessage(`Team owner login setup missing. Supabase SQL Editor me database/add-team-owner-bidding.sql run karo. Detail: ${error.message}`);
      return;
    }

    const team = data?.[0];
    if (!team) {
      setMessage('Team owner nahi mila. Admin Teams tab me Owner Mobile aur PIN check karo.');
      return;
    }

    const session = { ...team, owner_pin: pin.trim() };
    sessionStorage.setItem('cpl-owner-session', JSON.stringify(session));
    setOwnerSession(session);
    onSuccess?.();
  }

  const form = (
    <form className="panel form-panel login-form-panel" onSubmit={submit}>
      <label>
        Owner Mobile Number
        <input
          inputMode="numeric"
          maxLength="10"
          value={mobile}
          onChange={(e) => setMobile(digitsOnly(e.target.value))}
          required
        />
      </label>
      <label>
        Owner PIN
        <input
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(numericText(e.target.value).slice(0, 8))}
          placeholder="Mobile last 4 digit, if default"
          required
        />
      </label>
      <button className="primary-button" disabled={busy || mobile.length !== 10}>
        <KeyRound size={18} />
        {busy ? 'Checking...' : 'Enter owner room'}
      </button>
    </form>
  );

  if (compact) return form;

  return (
    <section className="auth-grid">
      <div className="auth-copy owner-copy">
        <WalletCards size={34} />
        <h1>Team owner bidding</h1>
        <p>Team owner apne mobile, laptop ya desktop se live player par bid place kar sakta hai. Budget aur roster validation automatic rahega.</p>
      </div>
      {form}
    </section>
  );
}

function PlayerRegistration({
  players,
  settings,
  tournament,
  selectedTournamentId,
  setMessage,
  paymentQrUrl = '',
  showHeader = true,
  showTable = true,
  showPhotoSection = true,
  requirePhoto = true,
  onSaved
}) {
  const [form, setForm] = useState(blankRegistration);
  const [photoFile, setPhotoFile] = useState(null);
  const [paymentFile, setPaymentFile] = useState(null);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [paymentPreview, setPaymentPreview] = useState('');
  const [aadhaarPreview, setAadhaarPreview] = useState('');
  const [barcodePreview, setBarcodePreview] = useState(paymentQrUrl || '');
  const [photoCrop, setPhotoCrop] = useState(defaultPassportCrop);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBarcodePreview(paymentQrUrl || '');
  }, [paymentQrUrl]);

  function updatePhoto(file) {
    setPhotoFile(file || null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : '');
    setPhotoCrop(defaultPassportCrop);
  }

  function updatePaymentFile(file) {
    setPaymentFile(file || null);
    if (paymentPreview) URL.revokeObjectURL(paymentPreview);
    setPaymentPreview(filePreviewUrl(file));
  }

  function updateAadhaarFile(file) {
    setAadhaarFile(file || null);
    if (aadhaarPreview) URL.revokeObjectURL(aadhaarPreview);
    setAadhaarPreview(filePreviewUrl(file));
  }

  async function submit(event) {
    event.preventDefault();
    if (!selectedTournamentId) return setMessage('Select a tournament before registration.');
    if (requirePhoto && !photoFile) return setMessage('Player photo is required.');

    const mobile = digitsOnly(form.mobile_number);
    if (mobile.length !== 10) return setMessage('Mobile number must be 10 digits.');

    setBusy(true);
    setMessage('Player save ho raha hai, please wait...');
    try {
      const photoData = photoFile ? await imageFileToPassportDataUrl(photoFile, photoCrop) : '';
      const paymentData = await imageFileToCompressedDataUrl(paymentFile, 560, 760, 0.48);
      const aadhaarData = await imageFileToCompressedDataUrl(aadhaarFile, 560, 760, 0.48);

      const { error } = await supabase.from('players').insert({
        tournament_id: selectedTournamentId,
        full_name: titleCase(form.full_name.trim()),
        mobile_number: mobile,
        base_price: 0,
        category: form.category,
        player_criteria: defaultPlayerCriteria,
        stats: {
          photo_url: photoData,
          player_criteria: defaultPlayerCriteria,
          tshirt_size: form.tshirt_size,
          tshirt_number: numericText(form.tshirt_number) || null,
          paid_amount: toNumber(form.paid_amount),
          payment_screenshot_url: paymentData,
          aadhaar_card_url: aadhaarData
        }
      });

      if (error) throw error;
      setMessage('Player saved successfully.');
      setForm(blankRegistration);
      updatePhoto(null);
      updatePaymentFile(null);
      updateAadhaarFile(null);
      setBarcodePreview(paymentQrUrl || '');
      event.target.reset();
      onSaved?.();
    } catch (error) {
      setMessage(formatSaveError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {showHeader && (
        <header className="page-header">
          <div>
            <p className="eyebrow">New Players Registration</p>
            <h1>{tournament?.name || 'New Players Registration'}</h1>
          </div>
        </header>
      )}

      <form className={classNames('panel registration-form', !showPhotoSection && 'without-photo-section')} onSubmit={submit}>
        {showPhotoSection && (
          <section className="registration-photo-panel">
            <div className="section-title">
              <Camera size={20} />
              <h2>Player Photo</h2>
            </div>
            <PhotoCropControl preview={photoPreview} crop={photoCrop} onCropChange={setPhotoCrop} emptyIcon={<Camera size={36} />} />
            <label className="file-button wide">
              <Camera size={18} />
              Select From Camera/Gallery
              <input type="file" accept="image/*" onChange={(e) => updatePhoto(e.target.files?.[0])} required={requirePhoto} disabled={busy} />
            </label>
          </section>
        )}

        <section className="form-panel nested-form">
          <div className="section-title">
            <UserPlus size={20} />
            <h2>Player Details</h2>
          </div>
          <label>
            Full Name
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: titleCase(e.target.value) })} required />
          </label>
          <label>
            Mobile Number
            <input inputMode="numeric" maxLength="10" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: digitsOnly(e.target.value) })} required />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {playerCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            T-Shirt Size
            <select value={form.tshirt_size} onChange={(e) => setForm({ ...form, tshirt_size: e.target.value })}>
              {tshirtSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <label>
            T-Shirt No
            <input inputMode="numeric" value={form.tshirt_number} onChange={(e) => setForm({ ...form, tshirt_number: numericText(e.target.value) })} />
          </label>
        </section>

        <section className="form-panel nested-form">
          <div className="section-title">
            <FileImage size={20} />
            <h2>Payment Details</h2>
          </div>
          {barcodePreview && (
            <div className="payment-qr-box">
              <img src={barcodePreview} alt="Payment barcode preview" />
            </div>
          )}
          <label>
            Paid Amount
            <input inputMode="numeric" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: numericText(e.target.value) })} required />
          </label>
          <label className="file-button wide">
            <Upload size={18} />
            Payment Screenshot (Optional)
            <input type="file" accept="image/*" onChange={(e) => updatePaymentFile(e.target.files?.[0] || null)} disabled={busy} />
          </label>
          <FilePreview title="Payment Screenshot" file={paymentFile} preview={paymentPreview} optional />
          <label className="file-button wide">
            <Upload size={18} />
            Aadhaar Card (Optional)
            <input type="file" accept="image/*" onChange={(e) => updateAadhaarFile(e.target.files?.[0] || null)} disabled={busy} />
          </label>
          <FilePreview title="Aadhaar Card" file={aadhaarFile} preview={aadhaarPreview} optional />
          <button className="primary-button" disabled={busy}>
            <CheckCircle2 size={18} />
            {busy ? 'Saving, please wait...' : 'Save Player'}
          </button>
        </section>
      </form>

      {showTable && <PlayerTable players={players} teams={[]} settings={settings} />}
    </div>
  );
}

function FilePreview({ title, file, preview, existing, optional = false }) {
  if (!file) {
    return <p className="upload-note">{existing ? `${title} Already Added` : `${title} ${optional ? 'Optional' : 'Not Selected'}`}</p>;
  }

  return (
    <div className="upload-preview">
      {preview ? (
        <img src={preview} alt={`${title} preview`} />
      ) : (
        <FileImage size={28} />
      )}
      <div>
        <strong>{title} Selected</strong>
        <span>{file.name}</span>
      </div>
    </div>
  );
}

function PhotoCropControl({ preview, crop, onCropChange, emptyIcon }) {
  if (!preview) {
    return (
      <div className="photo-preview crop-frame">
        {emptyIcon || <Camera size={36} />}
      </div>
    );
  }

  return (
    <div className="photo-cropper">
      <div className="easy-crop-frame">
        <Cropper
          image={preview}
          crop={{ x: crop.x, y: crop.y }}
          zoom={crop.zoom}
          aspect={passportAspectRatio}
          cropShape="rect"
          showGrid
          objectFit="contain"
          onCropChange={(nextCrop) => onCropChange((current) => ({ ...current, ...nextCrop }))}
          onZoomChange={(nextZoom) => onCropChange((current) => ({ ...current, zoom: nextZoom }))}
          onCropComplete={(_croppedArea, croppedAreaPixels) => {
            onCropChange((current) => ({ ...current, croppedAreaPixels }));
          }}
        />
      </div>
      <div className="crop-controls">
        <label>
          Zoom
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.05"
            value={crop.zoom}
            onChange={(event) => onCropChange((current) => ({ ...current, zoom: Number(event.target.value) }))}
          />
        </label>
        <button type="button" className="ghost-button inline small" onClick={() => onCropChange(defaultPassportCrop)}>
          Center Photo
        </button>
      </div>
    </div>
  );
}

function AdminDashboard({
  settings,
  tournament,
  tournaments,
  selectedTournamentId,
  selectTournament,
  loadTournamentsAndCurrentData,
  teams,
  players,
  logs,
  currentPlayer,
  highestTeam,
  websiteContent,
  setWebsiteContent,
  setMessage,
  loadAll,
  setView,
  auctionResult,
  setAuctionResult,
  adminRole = 'admin'
}) {
  const [tab, setTab] = useState('auction');
  const canManagePasswords = adminRole === 'admin';
  const tabs = [
    { key: 'tournament', label: 'Tournament', icon: Trophy },
    { key: 'website', label: 'Website Control', icon: MonitorUp },
    { key: 'auction', label: 'Live Auction', icon: Gavel },
    { key: 'scoring', label: 'Match Scoring', icon: Activity },
    { key: 'teams', label: 'Teams', icon: Users },
    { key: 'players', label: 'Players', icon: ListChecks },
    { key: 'standings', label: 'Standings', icon: Trophy },
    { key: 'reports', label: 'Reports', icon: Download },
    { key: 'pamphlet', label: 'Pamphlet', icon: Printer },
    canManagePasswords && { key: 'security', label: 'Password', icon: Shield }
  ].filter(Boolean);

  useEffect(() => {
    if (!selectedTournamentId) setTab('tournament');
    if (!canManagePasswords && tab === 'security') setTab('auction');
  }, [canManagePasswords, selectedTournamentId, tab]);

  async function savePamphletDraft(pamphletDraft) {
    if (!selectedTournamentId) return;
    const content = mergeWebsiteContent({ ...websiteContent, pamphlet_draft: pamphletDraft });
    setWebsiteContent(content);
    const localSaved = await writeLocalWebsiteContent(selectedTournamentId, content);

    try {
      const { error } = await supabase
        .from('website_content')
        .upsert(
          {
            tournament_id: selectedTournamentId,
            content,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'tournament_id' }
        );
      if (error) throw error;
      setMessage('Pamphlet saved.');
    } catch {
      setMessage(localSaved
        ? 'Pamphlet local save ho gaya. Online save ke liye Supabase SQL setup check karo.'
        : 'Pamphlet save nahi hua. Image/data size chhota karke dobara try karo.');
    }
  }

  function openTab(itemKey) {
    if (itemKey === 'scoring') {
      setView('scoring');
      return;
    }
    setTab(itemKey);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{adminRole === 'subadmin' ? 'Sub Admin Dashboard' : 'Admin Dashboard'}</p>
          <h1>{tournament?.name || 'Tournament Setup'}</h1>
        </div>
      </header>

      <div className="tabs">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} className={classNames(tab === item.key && 'active')} onClick={() => openTab(item.key)}>
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'tournament' && (
        <TournamentAdmin
          settings={settings}
          tournament={tournament}
          tournaments={tournaments}
          selectedTournamentId={selectedTournamentId}
          selectTournament={selectTournament}
          loadTournamentsAndCurrentData={loadTournamentsAndCurrentData}
          setMessage={setMessage}
        />
      )}
      {tab === 'website' && selectedTournamentId && (
        <WebsiteControlAdmin
          websiteContent={websiteContent}
          tournament={tournament}
          selectedTournamentId={selectedTournamentId}
          setWebsiteContent={setWebsiteContent}
          setMessage={setMessage}
        />
      )}
      {tab === 'auction' && selectedTournamentId && (
        <LiveAuctionAdmin
          settings={settings}
          selectedTournamentId={selectedTournamentId}
          teams={teams}
          players={players}
          logs={logs}
          currentPlayer={currentPlayer}
          highestTeam={highestTeam}
          setMessage={setMessage}
          loadAll={loadAll}
          auctionResult={auctionResult}
          setAuctionResult={setAuctionResult}
        />
      )}
      {tab === 'scoring' && selectedTournamentId && (
        <MatchScoring
          tournament={tournament}
          selectedTournamentId={selectedTournamentId}
          teams={teams}
          players={players}
          settings={settings}
          setMessage={setMessage}
          canEdit
        />
      )}
      {tab === 'teams' && selectedTournamentId && <TeamsAdmin teams={teams} players={players} settings={settings} selectedTournamentId={selectedTournamentId} setMessage={setMessage} />}
      {tab === 'players' && selectedTournamentId && (
        <PlayersAdmin
          players={players}
          teams={teams}
          settings={settings}
          selectedTournamentId={selectedTournamentId}
          setMessage={setMessage}
          loadAll={loadAll}
        />
      )}
      {tab === 'standings' && selectedTournamentId && <Standings teams={teams} players={players} settings={settings} />}
      {tab === 'reports' && selectedTournamentId && <AuctionHistoryReport tournament={tournament} teams={teams} players={players} settings={settings} />}
      {tab === 'pamphlet' && (
        <TournamentPamphlet
          tournament={tournament}
          settings={settings}
          teams={teams}
          players={players}
          savedDraft={websiteContent?.pamphlet_draft}
          onSaveDraft={savePamphletDraft}
        />
      )}
      {tab === 'security' && canManagePasswords && <AdminPasswordAdmin setMessage={setMessage} />}
    </div>
  );
}

function WebsiteControlAdmin({ websiteContent, tournament, selectedTournamentId, setWebsiteContent, setMessage }) {
  const [form, setForm] = useState(mergeWebsiteContent(websiteContent));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(mergeWebsiteContent(websiteContent));
  }, [websiteContent]);

  function updateSection(section, key, value) {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value
      }
    }));
  }

  function updateListItem(listName, index, key, value) {
    setForm((current) => {
      const list = [...(current[listName] || [])];
      list[index] = { ...(list[index] || {}), [key]: value };
      return { ...current, [listName]: list };
    });
  }

  function addListItem(listName, item) {
    setForm((current) => ({ ...current, [listName]: [...(current[listName] || []), item] }));
  }

  function removeListItem(listName, index) {
    setForm((current) => ({
      ...current,
      [listName]: (current[listName] || []).filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function updateGalleryImage(index, file) {
    if (!file) return;
    try {
      const imageUrl = await imageFileToCompressedDataUrl(file, 760, 520, 0.68);
      updateListItem('gallery', index, 'image_url', imageUrl);
      setMessage('Gallery photo selected.');
    } catch (error) {
      setMessage(formatSaveError(error));
    }
  }

  async function updateTestimonialImage(index, file) {
    if (!file) return;
    try {
      const imageUrl = await imageFileToCompressedDataUrl(file, 320, 320, 0.7);
      updateListItem('testimonials', index, 'image_url', imageUrl);
      setMessage('Testimonial photo selected.');
    } catch (error) {
      setMessage(formatSaveError(error));
    }
  }

  async function saveWebsiteContent(event) {
    event.preventDefault();
    setBusy(true);
    const content = mergeWebsiteContent(form);
    setWebsiteContent(content);
    const localSaved = await writeLocalWebsiteContent(selectedTournamentId, content);

    try {
      const { error } = await supabase
        .from('website_content')
        .upsert(
          {
            tournament_id: selectedTournamentId,
            content,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'tournament_id' }
        );
      if (error) throw error;
    } catch {
      setBusy(false);
      setMessage(localSaved
        ? 'Website content save ho gaya. Online permanent save ke liye Supabase SQL Editor me database/add-website-control.sql run hona chahiye.'
        : 'Website content page par apply ho gaya. Photo size bahut bada hai, smaller image select karke dobara save karo.');
      return;
    }

    setBusy(false);
    setMessage('Website content saved.');
  }

  return (
    <form className="stack" onSubmit={saveWebsiteContent}>
      <section className="panel form-panel">
        <div className="section-title">
          <MonitorUp size={20} />
          <h2>Website Control</h2>
        </div>
        <div className="control-grid">
          <label>
            Hero Small Title
            <input value={form.hero.eyebrow} onChange={(e) => updateSection('hero', 'eyebrow', titleCase(e.target.value))} />
          </label>
          <label>
            Hero Main Title
            <input value={form.hero.title} onChange={(e) => updateSection('hero', 'title', titleCase(e.target.value))} placeholder={tournament?.name || 'CPL Player Auction'} />
          </label>
          <label>
            Popup Button Text
            <input value={form.popup.button_label} onChange={(e) => updateSection('popup', 'button_label', titleCase(e.target.value))} />
          </label>
        </div>
        <label>
          Hero Description
          <textarea rows="3" value={form.hero.lead} onChange={(e) => updateSection('hero', 'lead', titleCase(e.target.value))} />
        </label>
      </section>

      <section className="panel form-panel">
        <div className="section-title">
          <FileImage size={20} />
          <h2>Popup Notice</h2>
        </div>
        <label className="checkbox-line">
          <input type="checkbox" checked={form.popup.enabled} onChange={(e) => updateSection('popup', 'enabled', e.target.checked)} />
          Show Popup On Home Page
        </label>
        <div className="control-grid">
          <label>
            Popup Title
            <input value={form.popup.title} onChange={(e) => updateSection('popup', 'title', titleCase(e.target.value))} />
          </label>
          <label className="wide-field">
            Popup Message
            <textarea rows="2" value={form.popup.message} onChange={(e) => updateSection('popup', 'message', titleCase(e.target.value))} />
          </label>
        </div>
      </section>

      <section className="panel form-panel">
        <div className="section-title">
          <Trophy size={20} />
          <h2>About And Contact</h2>
        </div>
        <div className="control-grid">
          <label>
            About Small Title
            <input value={form.about.eyebrow} onChange={(e) => updateSection('about', 'eyebrow', titleCase(e.target.value))} />
          </label>
          <label>
            About Title
            <input value={form.about.title} onChange={(e) => updateSection('about', 'title', titleCase(e.target.value))} />
          </label>
          <label>
            Contact Heading
            <input value={form.contact.title} onChange={(e) => updateSection('contact', 'title', titleCase(e.target.value))} />
          </label>
        </div>
        <label>
          About Text
          <textarea rows="4" value={form.about.body} onChange={(e) => updateSection('about', 'body', titleCase(e.target.value))} />
        </label>
        <div className="control-grid">
          <label>
            Address
            <textarea rows="3" value={form.contact.address} onChange={(e) => updateSection('contact', 'address', titleCase(e.target.value))} />
          </label>
          <label>
            Phone 1
            <input inputMode="numeric" value={form.contact.phone_1} onChange={(e) => updateSection('contact', 'phone_1', numericText(e.target.value))} />
          </label>
          <label>
            Phone 2
            <input inputMode="numeric" value={form.contact.phone_2} onChange={(e) => updateSection('contact', 'phone_2', numericText(e.target.value))} />
          </label>
          <label>
            Email
            <input type="email" value={form.contact.email} onChange={(e) => updateSection('contact', 'email', e.target.value.trim())} />
          </label>
        </div>
      </section>

      <section className="panel form-panel">
        <div className="admin-list-header">
          <div className="section-title">
            <Star size={20} />
            <h2>Testimonials</h2>
          </div>
          <button type="button" className="accent-button small" onClick={() => addListItem('testimonials', { name: '', text: '', image_url: '' })}>
            <Plus size={15} /> Add Testimonial
          </button>
        </div>
        <div className="content-editor-list">
          {form.testimonials.map((item, index) => (
            <div className="content-editor-row" key={`testimonial-${index}`}>
              <div className="testimonial-editor-photo">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name || 'Testimonial preview'} />
                ) : (
                  <Camera size={28} />
                )}
                <label className="file-button compact-upload">
                  <Upload size={15} />
                  Photo
                  <input type="file" accept="image/*" onChange={(e) => updateTestimonialImage(index, e.target.files?.[0])} />
                </label>
              </div>
              <label>
                Name
                <input value={item.name} onChange={(e) => updateListItem('testimonials', index, 'name', titleCase(e.target.value))} />
              </label>
              <label>
                Message
                <textarea rows="2" value={item.text} onChange={(e) => updateListItem('testimonials', index, 'text', titleCase(e.target.value))} />
              </label>
              <button type="button" className="danger-button small" onClick={() => removeListItem('testimonials', index)}>
                <Trash2 size={15} /> Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel form-panel">
        <div className="admin-list-header">
          <div className="section-title">
            <ImageIcon size={20} />
            <h2>Gallery</h2>
          </div>
          <button type="button" className="accent-button small" onClick={() => addListItem('gallery', { title: '', caption: '', image_url: '' })}>
            <Plus size={15} /> Add Photo
          </button>
        </div>
        <div className="gallery-editor-grid">
          {form.gallery.map((item, index) => (
            <article className="gallery-editor-card" key={`gallery-${index}`}>
              <div className="gallery-upload-preview">
                {item.image_url ? <img src={item.image_url} alt={item.title || 'Gallery preview'} /> : <Camera size={34} />}
              </div>
              <label className="file-button wide">
                <Upload size={17} />
                Select Photo
                <input type="file" accept="image/*" onChange={(e) => updateGalleryImage(index, e.target.files?.[0])} />
              </label>
              <label>
                Title
                <input value={item.title} onChange={(e) => updateListItem('gallery', index, 'title', titleCase(e.target.value))} />
              </label>
              <label>
                Caption
                <input value={item.caption} onChange={(e) => updateListItem('gallery', index, 'caption', titleCase(e.target.value))} />
              </label>
              <button type="button" className="danger-button small" onClick={() => removeListItem('gallery', index)}>
                <Trash2 size={15} /> Remove
              </button>
            </article>
          ))}
          {!form.gallery.length && <p className="empty-text">Gallery photo add karne ke liye Add Photo click karo.</p>}
        </div>
      </section>

      <div className="button-row">
        <button className="primary-button" disabled={busy}>
          <Save size={18} /> {busy ? 'Saving...' : 'Save Website Control'}
        </button>
      </div>
    </form>
  );
}

function TournamentAdmin({ settings, tournament, tournaments, selectedTournamentId, selectTournament, loadTournamentsAndCurrentData, setMessage }) {
  const [editingTournamentId, setEditingTournamentId] = useState(selectedTournamentId || null);
  const [form, setForm] = useState(tournamentToForm(tournament));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedTournamentId && editingTournamentId === selectedTournamentId) {
      setForm(tournamentToForm(tournament));
    }
  }, [tournament]);

  function startCreate() {
    setEditingTournamentId(null);
    setForm(blankTournament);
  }

  function startEdit(item) {
    setEditingTournamentId(item.id);
    setForm(tournamentToForm(item));
    selectTournament(item.id);
  }

  async function updateLogo(file) {
    if (!file) return;
    try {
      const logoData = await imageFileToCompressedDataUrl(file, 420, 420, 0.82);
      setForm((current) => ({ ...current, logo_url: logoData }));
      setMessage('Logo selected.');
    } catch (error) {
      setMessage(formatSaveError(error));
    }
  }

  async function submitTournament(event) {
    event.preventDefault();
    if (!form.name.trim()) return setMessage('Tournament name is required.');

    setBusy(true);
    if (editingTournamentId) {
      const { error } = await supabase
        .from('tournaments')
        .update({
          name: titleCase(form.name.trim()),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          auction_end_date: form.auction_end_date || null,
          address: form.address.trim() || null,
          logo_url: form.logo_url.trim() || null,
          description: form.description.trim() || null
        })
        .eq('id', editingTournamentId);
      setBusy(false);

      if (error) return setMessage(error.message.includes('auction_end_date')
        ? `Auction End Date column missing hai. Supabase SQL Editor me database/add-auction-end-date.sql run karo. Detail: ${error.message}`
        : error.message);
      selectTournament(editingTournamentId);
      await loadTournamentsAndCurrentData();
      setMessage('Tournament details updated.');
      return;
    }

    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name: titleCase(form.name.trim()),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        auction_end_date: form.auction_end_date || null,
        address: form.address.trim() || null,
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim() || null
      })
      .select('id')
      .single();
    setBusy(false);

    if (error) return setMessage(error.message.includes('auction_end_date')
      ? `Auction End Date column missing hai. Supabase SQL Editor me database/add-auction-end-date.sql run karo. Detail: ${error.message}`
      : error.message);
    await supabase.from('tournament_settings').upsert({ tournament_id: data.id });
    setEditingTournamentId(data.id);
    selectTournament(data.id);
    await loadTournamentsAndCurrentData();
    setMessage('Tournament created.');
  }

  async function deleteTournament(item) {
    const confirmed = window.confirm(`Delete "${item.name}" tournament? Iske teams, players aur auction logs bhi delete honge.`);
    if (!confirmed) return;

    const { error } = await supabase.from('tournaments').delete().eq('id', item.id);
    if (error) return setMessage(error.message);
    if (selectedTournamentId === item.id) {
      localStorage.removeItem('cpl-selected-tournament-id');
    }
    if (editingTournamentId === item.id) {
      startCreate();
    }
    await loadTournamentsAndCurrentData();
    setMessage('Tournament deleted.');
  }

  async function deleteSelectedTournaments(selectedTournaments) {
    if (!selectedTournaments.length) return false;
    const confirmed = window.confirm(`Delete ${selectedTournaments.length} selected tournaments? Inke teams, players aur auction logs bhi delete honge.`);
    if (!confirmed) return false;

    const selectedIds = selectedTournaments.map((item) => item.id);
    const { error } = await supabase.from('tournaments').delete().in('id', selectedIds);
    if (error) {
      setMessage(error.message);
      return false;
    }
    if (selectedIds.includes(selectedTournamentId)) {
      localStorage.removeItem('cpl-selected-tournament-id');
      sessionStorage.removeItem('cpl-player-session');
      sessionStorage.removeItem('cpl-owner-session');
    }
    if (selectedIds.includes(editingTournamentId)) startCreate();
    await loadTournamentsAndCurrentData();
    setMessage(`${selectedTournaments.length} tournaments deleted.`);
    return true;
  }

  return (
    <div className="stack">
      <div className="two-column">
        <form className="panel form-panel" onSubmit={submitTournament}>
          <div className="section-title">
            <Trophy size={20} />
            <h2>{editingTournamentId ? 'Edit Tournament' : 'Create Tournament'}</h2>
          </div>
          <label>
            Tournament Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: titleCase(e.target.value) })} required />
          </label>
          <div className="tournament-settings-inline">
            <CurrencyAndTournament
              settings={settings}
              tournaments={tournaments}
              selectedTournamentId={selectedTournamentId}
              selectTournament={selectTournament}
              setMessage={setMessage}
            />
          </div>
          <div className="control-grid">
            <label>
              Start Date
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </label>
            <label>
              End Date
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </label>
            <label>
              Auction End Date
              <input type="date" value={form.auction_end_date} onChange={(e) => setForm({ ...form, auction_end_date: e.target.value })} />
            </label>
            <label>
              Logo Upload
              <span className="logo-upload-row">
                {form.logo_url ? <img src={form.logo_url} alt="Tournament logo preview" /> : <ImageIcon size={26} />}
                <span className="file-button compact-upload">
                  <Upload size={17} />
                  Select Logo
                  <input type="file" accept="image/*" onChange={(e) => updateLogo(e.target.files?.[0])} />
                </span>
              </span>
            </label>
          </div>
          <label>
            Address
            <textarea rows="3" value={form.address} onChange={(e) => setForm({ ...form, address: titleCase(e.target.value) })} />
          </label>
          <label>
            Short Note
            <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: titleCase(e.target.value) })} />
          </label>
          <div className="button-row">
            <button className="primary-button" disabled={busy}>
              {editingTournamentId ? <Save size={18} /> : <Plus size={18} />}
              {busy ? 'Saving...' : editingTournamentId ? 'Save Tournament' : 'Create Tournament'}
            </button>
            <button type="button" className="ghost-button inline" onClick={startCreate}>
              <Plus size={18} /> Add New
            </button>
          </div>
        </form>

        <section className="panel tournament-summary">
          {tournament?.logo_url ? (
            <img className="tournament-logo" src={tournament.logo_url} alt={`${tournament.name} logo`} />
          ) : (
            <span className="tournament-logo placeholder"><ImageIcon size={42} /></span>
          )}
          <p className="eyebrow">Selected Tournament</p>
          <h2>{tournament?.name || 'No tournament selected'}</h2>
          <p><CalendarDays size={16} /> {formatDateRange(tournament?.start_date, tournament?.end_date)}</p>
          <p><MapPin size={16} /> {tournament?.address || 'Address not added'}</p>
        </section>
      </div>

      <TournamentTable
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        onSelect={selectTournament}
        onEdit={startEdit}
        onDelete={deleteTournament}
        onBulkDelete={deleteSelectedTournaments}
      />
    </div>
  );
}

function TournamentTable({ tournaments, selectedTournamentId, onSelect, onEdit, onDelete, onBulkDelete }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectedCount = selectedIds.size;
  const allSelected = tournaments.length > 0 && tournaments.every((item) => selectedIds.has(item.id));

  function toggleSelected(tournamentId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(tournamentId)) next.delete(tournamentId);
      else next.add(tournamentId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) tournaments.forEach((item) => next.delete(item.id));
      else tournaments.forEach((item) => next.add(item.id));
      return next;
    });
  }

  async function deleteSelected() {
    if (!onBulkDelete) return;
    const selectedTournaments = tournaments.filter((item) => selectedIds.has(item.id));
    const deleted = await onBulkDelete(selectedTournaments);
    if (deleted) setSelectedIds(new Set());
  }

  return (
    <section className="panel table-panel">
      <div className="table-topbar">
        <div className="section-title">
          <Trophy size={20} />
          <h2>Tournament Details</h2>
        </div>
        <div className="table-tools">
          <label className="checkbox-line">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select All
          </label>
          <span className="summary-pill">{selectedCount} Selected</span>
          <button type="button" className="danger-button small" onClick={deleteSelected} disabled={!selectedCount}>
            <Trash2 size={15} /> Delete Selected
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Name</th>
              <th>Dates</th>
              <th>Address</th>
              <th>Logo</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((item) => (
              <tr key={item.id}>
                <td>
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} />
                </td>
                <td>{item.name}</td>
                <td>{formatDateRange(item.start_date, item.end_date)}</td>
                <td>{item.address || '-'}</td>
                <td>{item.logo_url ? 'Added' : '-'}</td>
                <td>{selectedTournamentId === item.id ? <span className="status-pill added">Selected</span> : '-'}</td>
                <td>
                  <div className="mini-actions">
                    <button className="ghost-button inline small" onClick={() => onSelect(item.id)}>
                      <CheckCircle2 size={15} /> Select
                    </button>
                    <button className="accent-button small" onClick={() => onEdit(item)}>
                      <Pencil size={15} /> Edit
                    </button>
                    <button className="danger-button small" onClick={() => onDelete(item)}>
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!tournaments.length && (
              <tr>
                <td colSpan="7">No tournament added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TournamentPamphlet({ tournament, settings, teams, players, editable = true, showPrintButton = true, savedDraft, onSaveDraft }) {
  const registeredPlayers = players.length;
  const auctionPlayers = players.filter((player) => player.sold_status !== 'Unsold').length;
  const activeTeams = teams.length ? teams : Array.from({ length: Math.min(toNumber(settings.team_count, 4), 4) }, (_, index) => ({
    id: `sample-${index}`,
    team_name: `Team ${index + 1}`
  }));
  const defaultDraft = {
    title: tournament?.name || 'Cricket Premier',
    subtitle: 'Tennis Ball Cricket Tournament',
    cupLine: '30 Yard Cup 2026',
    startLine: `Match start from ${formatDate(tournament?.start_date) || 'Date to be announced'}`,
    entryFee: '2000',
    firstPrize: '7000',
    secondPrize: '3500',
    scheduleMode: 'single',
    poolAssignments: {},
    matchesPerDay: '1',
    sundayMatches: '2',
    playoffMatches: '3',
    playoffMatchesPerDay: '1',
    firstMatchTime: '07:00',
    matchGapMinutes: '150',
    venue: tournament?.address || 'Venue to be announced',
    rules: [
      '7 Over Match',
      '2 Bowler 2-2 Over',
      '3 Bowler 1-1 Over',
      'Match count per day as selected',
      'Play Fair & Respect',
      "Umpire's Decision Final"
    ].join('\n'),
    format: [
      `Total ${activeTeams.length} Teams`,
      'League Matches (Round Robin)',
      'Playoff matches as selected',
      'Each match 7 Over',
      'Sunday match count as selected',
      "Umpire's Decision Final"
    ].join('\n'),
    awards: [
      'Man of the Match - Rs 1000',
      'Match of the Tournament - Rs 1000',
      'Best Bowler - Rs 500',
      'Best Batsman - Rs 500',
      'Best Catch - Rs 500'
    ].join('\n'),
    footer: "Let's make this tournament a grand success"
  };
  const savedDraftKey = JSON.stringify(savedDraft || {});
  const initialDraft = { ...defaultDraft, ...(savedDraft || {}) };
  const [draft, setDraft] = useState(initialDraft);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    setDraft({ ...defaultDraft, ...(savedDraft || {}) });
  }, [tournament?.id, teams.length, savedDraftKey]);

  if (!tournament) {
    return (
      <section className="panel form-panel">
        <h2>Create a tournament first</h2>
        <p className="empty-text">Tournament details ke bina pamphlet generate nahi hoga.</p>
      </section>
    );
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveCurrentDraft() {
    if (!onSaveDraft) return;
    setSavingDraft(true);
    await onSaveDraft(draft);
    setSavingDraft(false);
  }

  function textLines(value) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function addDays(value, days) {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    return base;
  }

  function localDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function matchTimeForSlot(slotIndex) {
    const [hourText = '7', minuteText = '0'] = String(draft.firstMatchTime || '07:00').split(':');
    const startMinutes = toNumber(hourText, 7) * 60 + toNumber(minuteText, 0);
    const totalMinutes = startMinutes + slotIndex * Math.max(30, toNumber(draft.matchGapMinutes, 150));
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }

  function buildRoundRobinPairs(teamList, poolLabel = '') {
    const pairs = [];
    for (let outer = 0; outer < teamList.length; outer += 1) {
      for (let inner = outer + 1; inner < teamList.length; inner += 1) {
        pairs.push({ teamA: teamList[outer], teamB: teamList[inner], poolLabel });
      }
    }
    return pairs;
  }

  function leaguePairs() {
    if (draft.scheduleMode === 'pools') {
      const [poolA, poolB] = poolTeams();
      const poolAPairs = buildRoundRobinPairs(poolA, 'Pool - A');
      const poolBPairs = buildRoundRobinPairs(poolB, 'Pool - B');
      const alternatingPairs = [];
      const pairCount = Math.max(poolAPairs.length, poolBPairs.length);
      for (let index = 0; index < pairCount; index += 1) {
        if (poolAPairs[index]) alternatingPairs.push(poolAPairs[index]);
        if (poolBPairs[index]) alternatingPairs.push(poolBPairs[index]);
      }
      return alternatingPairs;
    }
    return buildRoundRobinPairs(activeTeams);
  }

  function poolTeams() {
    const splitIndex = Math.ceil(activeTeams.length / 2);
    const assignments = draft.poolAssignments || {};
    const poolA = [];
    const poolB = [];
    activeTeams.forEach((team, index) => {
      const savedPool = assignments[String(team.id)];
      const pool = savedPool === 'A' || savedPool === 'B' ? savedPool : (index < splitIndex ? 'A' : 'B');
      if (pool === 'B') poolB.push(team);
      else poolA.push(team);
    });
    return [poolA, poolB];
  }

  function teamColorStyle(team) {
    const index = activeTeams.findIndex((item) => item.id === team?.id);
    const safeIndex = Math.max(0, index);
    const hue = Math.round((safeIndex * 137.508) % 360);
    const secondHue = (hue + 24) % 360;
    return {
      background: `linear-gradient(135deg, hsl(${hue} 78% 42%), hsl(${secondHue} 82% 27%))`
    };
  }

  function updateTeamPool(teamId, pool) {
    setDraft((current) => ({
      ...current,
      poolAssignments: {
        ...(current.poolAssignments || {}),
        [String(teamId)]: pool
      }
    }));
  }

  function chunkItems(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks.length ? chunks : [[]];
  }

  function scheduleRows() {
    const pairs = leaguePairs();
    const sundayMatches = Math.min(4, Math.max(1, toNumber(draft.sundayMatches, 2)));
    const matchesPerDay = Math.min(4, Math.max(1, toNumber(draft.matchesPerDay, 1)));
    const playoffMatches = Math.min(5, Math.max(1, toNumber(draft.playoffMatches, 3)));
    const playoffMatchesPerDay = Math.min(3, Math.max(1, toNumber(draft.playoffMatchesPerDay, 1)));
    const playoffNames = ['Semifinal / Qualifier', 'Semifinal / Eliminator', 'Final', 'Reserve Final', 'Super Final'];
    const leagueRows = [];
    let scheduleDate = addDays(tournament.start_date, 0);
    let pairIndex = 0;
    while (pairIndex < pairs.length) {
      const matchesForDay = scheduleDate.getDay() === 0 ? sundayMatches : matchesPerDay;
      for (let slotIndex = 0; slotIndex < matchesForDay && pairIndex < pairs.length; slotIndex += 1) {
        const { teamA, teamB, poolLabel } = pairs[pairIndex];
        leagueRows.push({
          no: leagueRows.length + 1,
          date: formatDate(localDateValue(scheduleDate)),
          day: new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(scheduleDate),
          time: matchTimeForSlot(slotIndex),
          teamA,
          teamB,
          poolLabel,
          match: `${teamA.team_name} vs ${teamB.team_name}`,
          type: 'league'
        });
        pairIndex += 1;
      }
      scheduleDate = addDays(localDateValue(scheduleDate), 1);
    }
    const playoffStart = leagueRows.length;
    const playoffDate = localDateValue(scheduleDate);
    const playoffRows = Array.from({ length: playoffMatches }, (_, index) => {
      const dayOffset = Math.floor(index / playoffMatchesPerDay);
      const slotIndex = index % playoffMatchesPerDay;
      const date = addDays(playoffDate, dayOffset);
      return {
        no: playoffStart + index + 1,
        date: formatDate(localDateValue(date)),
        day: index === playoffMatches - 1 ? 'Final' : 'Playoffs',
        time: matchTimeForSlot(slotIndex),
        match: playoffNames[index] || `Playoff ${index + 1}`,
        type: 'playoff'
      };
    });
    return [...leagueRows, ...playoffRows];
  }

  const generatedScheduleRows = scheduleRows();
  const [poolATeams, poolBTeams] = poolTeams();
  const schedulePages = chunkItems(generatedScheduleRows, 5);
  const teamPages = chunkItems(activeTeams, activeTeams.length > 8 ? 16 : 8);
  const coverTeams = draft.scheduleMode === 'pools'
    ? [...poolATeams.slice(0, 2), ...poolBTeams.slice(0, 2)]
    : activeTeams.slice(0, 4);
  const awardIcons = [Trophy, Crown, Star, Shield, BadgeIndianRupee];

  function renderAwards() {
    return textLines(draft.awards).slice(0, 5).map((line, index) => {
      const AwardIcon = awardIcons[index % awardIcons.length];
      return (
        <span key={line}>
          <AwardIcon aria-hidden="true" />
          <strong>{line}</strong>
        </span>
      );
    });
  }

  function renderPoolTeamColumns(withLogos = false, visibleTeams = activeTeams) {
    const visibleIds = new Set(visibleTeams.map((team) => String(team.id)));
    const pools = [
      { label: 'Pool - A', className: 'pool-a', teams: poolATeams.filter((team) => visibleIds.has(String(team.id))) },
      { label: 'Pool - B', className: 'pool-b', teams: poolBTeams.filter((team) => visibleIds.has(String(team.id))) }
    ];
    return (
      <div className={classNames('pamphlet-pool-grid', withLogos && 'with-logos')}>
        {pools.map((pool) => (
          <div key={pool.label} className={classNames('pamphlet-pool-column', pool.className)}>
            <h3>{pool.label}</h3>
            <div className={withLogos ? 'pamphlet-pool-team-logos' : 'pamphlet-pool-team-chips'}>
              {pool.teams.map((team) => (
                <div key={team.id} className="pamphlet-pool-team" style={teamColorStyle(team)}>
                  {withLogos && (team.logo_url ? <img src={team.logo_url} alt={`${team.team_name} logo`} /> : <Shield size={36} />)}
                  <strong>{team.team_name}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={classNames('pamphlet-workspace', !editable && 'public-pamphlet-workspace')}>
      {editable && (
        <section className="panel form-panel no-print">
          <div className="section-title">
            <Printer size={20} />
            <h2>Editable A4 Pamphlet</h2>
          </div>
          <div className="control-grid">
            <label>
              Main Title
              <input value={draft.title} onChange={(event) => updateDraft('title', titleCase(event.target.value))} />
            </label>
            <label>
              Subtitle
              <input value={draft.subtitle} onChange={(event) => updateDraft('subtitle', titleCase(event.target.value))} />
            </label>
            <label>
              Cup Line
              <input value={draft.cupLine} onChange={(event) => updateDraft('cupLine', titleCase(event.target.value))} />
            </label>
            <label>
              Start Line
              <input value={draft.startLine} onChange={(event) => updateDraft('startLine', titleCase(event.target.value))} />
            </label>
            <label>
              Entry Fee
              <input inputMode="numeric" value={draft.entryFee} onChange={(event) => updateDraft('entryFee', numericText(event.target.value))} />
            </label>
            <label>
              1st Prize
              <input inputMode="numeric" value={draft.firstPrize} onChange={(event) => updateDraft('firstPrize', numericText(event.target.value))} />
            </label>
            <label>
              2nd Prize
              <input inputMode="numeric" value={draft.secondPrize} onChange={(event) => updateDraft('secondPrize', numericText(event.target.value))} />
            </label>
            <label>
              Schedule Type
              <select value={draft.scheduleMode} onChange={(event) => updateDraft('scheduleMode', event.target.value)}>
                <option value="single">Single League / Round Robin</option>
                <option value="pools">2 Pool League</option>
              </select>
            </label>
            <label>
              Per Day Matches
              <select value={draft.matchesPerDay} onChange={(event) => updateDraft('matchesPerDay', event.target.value)}>
                <option value="1">1 Match</option>
                <option value="2">2 Matches</option>
                <option value="3">3 Matches</option>
                <option value="4">4 Matches</option>
              </select>
            </label>
            <label>
              Sunday Matches
              <select value={draft.sundayMatches} onChange={(event) => updateDraft('sundayMatches', event.target.value)}>
                <option value="1">1 Match</option>
                <option value="2">2 Matches</option>
                <option value="3">3 Matches</option>
                <option value="4">4 Matches</option>
              </select>
            </label>
            <label>
              Playoff Matches
              <select value={draft.playoffMatches} onChange={(event) => updateDraft('playoffMatches', event.target.value)}>
                <option value="1">1 Match</option>
                <option value="2">2 Matches</option>
                <option value="3">3 Matches</option>
                <option value="4">4 Matches</option>
                <option value="5">5 Matches</option>
              </select>
            </label>
            <label>
              Playoff Per Day
              <select value={draft.playoffMatchesPerDay} onChange={(event) => updateDraft('playoffMatchesPerDay', event.target.value)}>
                <option value="1">1 Match</option>
                <option value="2">2 Matches</option>
                <option value="3">3 Matches</option>
              </select>
            </label>
            <label>
              First Match Time
              <input type="time" value={draft.firstMatchTime} onChange={(event) => updateDraft('firstMatchTime', event.target.value)} />
            </label>
            <label>
              Match Gap
              <select value={draft.matchGapMinutes} onChange={(event) => updateDraft('matchGapMinutes', event.target.value)}>
                <option value="30">30 Min</option>
                <option value="60">1 Hour</option>
                <option value="90">1 Hour 30 Min</option>
                <option value="120">2 Hours</option>
                <option value="150">2 Hours 30 Min</option>
                <option value="180">3 Hours</option>
              </select>
            </label>
          </div>
          {draft.scheduleMode === 'pools' && (
            <div className="pool-assignment-editor">
              <div className="section-title">
                <Shuffle size={18} />
                <h3>Manual Pool Assignment</h3>
              </div>
              <div className="pool-assignment-grid">
                {activeTeams.map((team, index) => {
                  const currentPool = (draft.poolAssignments || {})[String(team.id)] || (index < Math.ceil(activeTeams.length / 2) ? 'A' : 'B');
                  return (
                    <label key={team.id}>
                      <span className="team-color-swatch" style={teamColorStyle(team)} />
                      <strong>{team.team_name}</strong>
                      <select value={currentPool} onChange={(event) => updateTeamPool(team.id, event.target.value)}>
                        <option value="A">Pool - A</option>
                        <option value="B">Pool - B</option>
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <label>
            Venue
            <input value={draft.venue} onChange={(event) => updateDraft('venue', titleCase(event.target.value))} />
          </label>
          <div className="control-grid">
            <label>
              Match Rules
              <textarea rows="6" value={draft.rules} onChange={(event) => updateDraft('rules', event.target.value)} />
            </label>
            <label>
              Tournament Format
              <textarea rows="6" value={draft.format} onChange={(event) => updateDraft('format', event.target.value)} />
            </label>
            <label>
              Prizes & Awards
              <textarea rows="6" value={draft.awards} onChange={(event) => updateDraft('awards', event.target.value)} />
            </label>
          </div>
          <label>
            Footer Message
            <input value={draft.footer} onChange={(event) => updateDraft('footer', titleCase(event.target.value))} />
          </label>
        </section>
      )}

      {showPrintButton && (
        <div className="button-row no-print">
          {editable && onSaveDraft && (
            <button type="button" className="accent-button" onClick={saveCurrentDraft} disabled={savingDraft}>
              <Save size={18} /> {savingDraft ? 'Saving...' : 'Save Pamphlet'}
            </button>
          )}
          <button className="primary-button" onClick={() => window.print()}>
            <Printer size={18} /> Print / Save A4 PDF
          </button>
        </div>
      )}

      <div className="pamphlet-set">
        <section className="pamphlet-poster pamphlet-cover">
          <div className="pamphlet-skyline" />
          <div className="pamphlet-corner left">Play<br />Fair<br />Respect<br />Enjoy</div>
          <div className="pamphlet-corner right">Small<br />Town<br />Big<br />Passion</div>
          <div className="pamphlet-title-lockup">
            <Crown size={36} />
            <h1>{draft.title}</h1>
            <strong>{draft.subtitle}</strong>
            <span>{draft.cupLine}</span>
          </div>
          <div className="pamphlet-venue">
            <MapPin size={20} />
            <b>{draft.venue}</b>
          </div>
          <div className="pamphlet-card-grid">
            <div className="pamphlet-box">
              <h3>Teams</h3>
              {draft.scheduleMode === 'pools' ? renderPoolTeamColumns(false, coverTeams) : (
                <div className="pamphlet-team-chips">
                  {coverTeams.map((team) => (
                    <span key={team.id} style={teamColorStyle(team)}>{team.team_name}</span>
                  ))}
                </div>
              )}
              {activeTeams.length > coverTeams.length && (
                <small className="pamphlet-more-teams">+{activeTeams.length - coverTeams.length} more teams on Team List page</small>
              )}
            </div>
            <div className="pamphlet-box">
              <h3>Match Rules</h3>
              <ul>
                {textLines(draft.rules).map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          </div>
          <div className="pamphlet-prize-strip">
            <div><span>Entry Fee</span><strong>Rs {draft.entryFee || 0}</strong></div>
            <Trophy size={88} />
            <div><span>Registered</span><strong>{registeredPlayers}</strong></div>
          </div>
          <div className="pamphlet-award-row">
            {renderAwards()}
          </div>
          <footer>{draft.footer}</footer>
        </section>

        {schedulePages.map((pageRows, pageIndex) => {
          const isLastPage = pageIndex === schedulePages.length - 1;
          return (
            <section key={`schedule-${pageIndex}`} className="pamphlet-poster pamphlet-schedule">
              <div className="pamphlet-page-number">Match Schedule - Page {pageIndex + 1} / {schedulePages.length}</div>
              <div className="pamphlet-title-lockup compact">
                <Crown size={30} />
                <h1>{draft.title}</h1>
                <strong>{draft.startLine}</strong>
              </div>
              <div className="pamphlet-schedule-summary">
                <span>{draft.scheduleMode === 'pools' ? '2 Pool League' : 'Single League / Round Robin'}</span>
                <span>{leaguePairs().length} League Matches</span>
                <span>{generatedScheduleRows.length} Total Matches</span>
              </div>
              <table className="pamphlet-schedule-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={`${row.no}-${row.match}`}>
                      <td>{row.no}</td>
                      <td>{row.date}</td>
                      <td>{row.day}</td>
                      <td>{row.time}</td>
                      <td className="pamphlet-match-cell">
                        {row.type === 'league' ? (
                          <div className="pamphlet-matchup">
                            {row.poolLabel && (
                              <span className={classNames('pamphlet-pool-label', row.poolLabel.includes('B') && 'pool-b')}>
                                {row.poolLabel}
                              </span>
                            )}
                            <span className="pamphlet-match-team" style={teamColorStyle(row.teamA)}>{row.teamA.team_name}</span>
                            <b>vs</b>
                            <span className="pamphlet-match-team" style={teamColorStyle(row.teamB)}>{row.teamB.team_name}</span>
                          </div>
                        ) : (
                          <strong className="pamphlet-playoff-match">{row.match}</strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pamphlet-playoff-band">{isLastPage ? 'Playoffs' : `Continued on Page ${pageIndex + 2}`}</div>
              {isLastPage && <div className="pamphlet-slogan">Same Ground, Same Passion, A New Champion</div>}
              <footer>Cricket Today, Better Tomorrow</footer>
            </section>
          );
        })}

        {teamPages.map((pageTeams, pageIndex) => {
          const wideTeamPage = activeTeams.length >= 8;
          return (
            <section
              key={`teams-${pageIndex}`}
              className={classNames('pamphlet-poster pamphlet-format', wideTeamPage && 'wide-team-poster')}
            >
              <div className="pamphlet-page-number">Team List - Page {pageIndex + 1} / {teamPages.length}</div>
              <div className="pamphlet-title-lockup compact">
                <Crown size={30} />
                <h1>{draft.title}</h1>
                <strong>Team List & Tournament Format</strong>
              </div>
              {draft.scheduleMode === 'pools' ? renderPoolTeamColumns(true, pageTeams) : (
                <div className="pamphlet-logo-grid">
                  {pageTeams.map((team) => (
                    <div key={team.id} className="pamphlet-team-logo" style={teamColorStyle(team)}>
                      {team.logo_url ? <img src={team.logo_url} alt={`${team.team_name} logo`} /> : <Shield size={42} />}
                      <strong>{team.team_name}</strong>
                    </div>
                  ))}
                </div>
              )}
              <footer>{draft.footer}</footer>
            </section>
          );
        })}

        <section className="pamphlet-poster pamphlet-format pamphlet-format-details">
          <div className="pamphlet-page-number">Format & Prizes</div>
          <div className="pamphlet-title-lockup compact">
            <Trophy size={34} />
            <h1>{draft.title}</h1>
            <strong>Tournament Format & Prizes</strong>
          </div>
          <div className="pamphlet-info-panel">
            <h3>Tournament Format</h3>
            <ul>
              {textLines(draft.format).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="pamphlet-prize-cards">
            <div><span>1st Prize</span><strong>Rs {draft.firstPrize || 0}</strong></div>
            <div><span>2nd Prize</span><strong>Rs {draft.secondPrize || 0}</strong></div>
            <div><span>Auction Mode</span><strong>{settings.currency_mode}</strong></div>
            <div><span>Auction Players</span><strong>{auctionPlayers}</strong></div>
          </div>
          <div className="pamphlet-award-row">
            {renderAwards()}
          </div>
          <footer>{draft.footer}</footer>
        </section>
      </div>

      <section className="pamphlet-a4 legacy-pamphlet">
        <div className="pamphlet-header">
          {tournament.logo_url ? (
            <img src={tournament.logo_url} alt={`${tournament.name} logo`} />
          ) : (
            <BrandMonogram />
          )}
          <div>
            <p>Cricket Players Auction</p>
            <h1>{tournament.name}</h1>
          </div>
        </div>

        <div className="pamphlet-band">
          <div>
            <strong>{formatDateRange(tournament.start_date, tournament.end_date)}</strong>
            <span>Schedule</span>
          </div>
          <div>
            <strong>{tournament.address || 'Venue to be announced'}</strong>
            <span>Venue</span>
          </div>
        </div>

        <p className="pamphlet-copy">
          {tournament.description || 'Professional cricket player auction with live bidding, team purse tracking, and player registration.'}
        </p>

        <div className="pamphlet-stats">
          <div><strong>{settings.team_count}</strong><span>Teams</span></div>
          <div><strong>{registeredPlayers}</strong><span>Registered Players</span></div>
          <div><strong>{teams.length}</strong><span>Active Teams</span></div>
          <div><strong>{auctionPlayers}</strong><span>Auction Activity</span></div>
        </div>

        <div className="pamphlet-footer">
          <span>Registration and auction managed by CPL Auction Software</span>
          <b>{settings.currency_mode} Auction</b>
        </div>
      </section>
    </div>
  );
}

function CurrencyAndTournament({ settings, tournaments, selectedTournamentId, selectTournament, setMessage }) {
  async function updateSetting(changes) {
    if (!selectedTournamentId) return;
    const { error } = await supabase
      .from('tournament_settings')
      .update(changes)
      .eq('tournament_id', selectedTournamentId);
    if (error) setMessage(error.message);
  }

  return (
    <div className="toolbar">
      {tournaments.length > 0 && (
        <label className="compact-field tournament-field">
          Tournament
          <select value={selectedTournamentId || ''} onChange={(e) => selectTournament(e.target.value)}>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="compact-field">
        Teams
        <input
          inputMode="numeric"
          list="team-count-options"
          min="1"
          value={settings.team_count || ''}
          onChange={(e) => {
            const count = toNumber(e.target.value);
            if (count > 0) updateSetting({ team_count: count });
          }}
        />
      </label>
      <datalist id="team-count-options">
        {suggestedTeamCounts.map((count) => (
          <option key={count} value={count} />
        ))}
      </datalist>
      <div className="segmented" role="group" aria-label="Currency mode">
        <button
          type="button"
          className={classNames(settings.currency_mode === 'Points' && 'active')}
          onClick={() => updateSetting({ currency_mode: 'Points' })}
        >
          <Banknote size={16} /> Points
        </button>
        <button
          type="button"
          className={classNames(settings.currency_mode === 'INR' && 'active')}
          onClick={() => updateSetting({ currency_mode: 'INR' })}
        >
          <BadgeIndianRupee size={16} /> INR
        </button>
      </div>
    </div>
  );
}

function AuctionResultCard({ result, settings, compact = false }) {
  const isSold = result?.status === 'Sold';

  return (
    <div className={classNames('auction-result-card', compact && 'compact', isSold ? 'sold' : 'unsold')}>
      <span>{isSold ? 'Player Sold' : 'Player Unsold'}</span>
      <h2>{result?.playerName || 'Player'}</h2>
      <div className="auction-result-price">{formatMoney(result?.amount || 0, settings.currency_mode)}</div>
      <strong>{isSold ? result?.teamName || 'Team' : 'No Team'}</strong>
    </div>
  );
}

function LiveAuctionAdmin({
  settings,
  selectedTournamentId,
  teams,
  players,
  logs,
  currentPlayer,
  highestTeam,
  setMessage,
  loadAll,
  auctionResult,
  setAuctionResult
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [bidTeamId, setBidTeamId] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [criteriaFilter, setCriteriaFilter] = useState('');
  const availablePlayers = players.filter((player) => player.sold_status !== 'Sold');
  const criteriaOptions = useMemo(() => {
    const values = availablePlayers
      .map((player) => playerCriteria(player))
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [availablePlayers]);
  const filteredAvailablePlayers = useMemo(() => {
    if (!criteriaFilter) return availablePlayers;
    return availablePlayers.filter((player) => playerCriteria(player) === criteriaFilter);
  }, [availablePlayers, criteriaFilter]);
  const previewPlayer = currentPlayer || players.find((item) => item.id === Number(selectedPlayerId));

  useEffect(() => {
    if (settings.current_player_id) setSelectedPlayerId(String(settings.current_player_id));
    setBidTeamId(settings.current_highest_team_id ? String(settings.current_highest_team_id) : '');
    const player = players.find((item) => item.id === settings.current_player_id);
    const minimum = Math.max(toNumber(settings.current_bid_amount), toNumber(player?.base_price));
    setBidAmount(minimum ? String(settings.current_highest_team_id ? minimum + bidIncrement : minimum) : '');
  }, [settings.current_player_id, settings.current_highest_team_id, settings.current_bid_amount, players]);

  function selectAuctionPlayer(playerId) {
    const player = players.find((item) => item.id === Number(playerId));
    setSelectedPlayerId(playerId);
    if (!settings.current_player_id) setBidAmount(player ? String(toNumber(player.base_price)) : '');
  }

  function selectRandomPlayer() {
    if (settings.current_player_id) return setMessage('Live player chal raha hai. Pehle Sold ya Unsold karke close karo.');
    if (!filteredAvailablePlayers.length) return setMessage('Is criteria me koi available player nahi hai.');
    const randomPlayer = filteredAvailablePlayers[Math.floor(Math.random() * filteredAvailablePlayers.length)];
    selectAuctionPlayer(String(randomPlayer.id));
    setMessage(`${randomPlayer.full_name} randomly selected.`);
  }

  async function startAuction() {
    const player = players.find((item) => item.id === Number(selectedPlayerId));
    if (!player) return setMessage('Select a player first.');

    const openingBid = Math.max(toNumber(player.base_price), toNumber(bidAmount));
    const { error: playerError } = await supabase
      .from('players')
      .update({
        base_price: openingBid,
        sold_status: 'Bidding',
        final_bid_price: null,
        assigned_team_id: null
      })
      .eq('id', player.id);
    if (playerError) return setMessage(playerError.message);

    const { error } = await supabase
      .from('tournament_settings')
      .update({
        current_player_id: player.id,
        current_bid_amount: openingBid,
        current_highest_team_id: null
      })
      .eq('tournament_id', selectedTournamentId);
    if (error) setMessage(error.message);
  }

  async function placeBid() {
    const team = teams.find((item) => item.id === Number(bidTeamId));
    if (!currentPlayer) return setMessage('Start an auction for a player first.');
    if (!team) return setMessage('Select a bidding team.');
    const teamRemaining = calculatedTeamRemaining(team, players);
    const teamPlayerCount = calculatedTeamPlayerCount(team, players);

    const amount = toNumber(bidAmount);
    const minimum = Math.max(toNumber(settings.current_bid_amount), toNumber(currentPlayer.base_price));
    const hasHighestBid = Boolean(settings.current_highest_team_id);
    const nextAllowed = hasHighestBid ? minimum + bidIncrement : minimum;
    if (amount < nextAllowed) {
      return setMessage(hasHighestBid
        ? `Next bid minimum ${formatMoney(nextAllowed, settings.currency_mode)} hona chahiye.`
        : `First bid base price ${formatMoney(minimum, settings.currency_mode)} ya usse jyada ho sakta hai.`);
    }
    if (amount > teamRemaining) return setMessage(`${team.team_name} does not have enough remaining budget.`);
    if (teamPlayerCount >= toNumber(team.max_players)) return setMessage(`${team.team_name} roster is full.`);

    const { error: logError } = await supabase.from('auction_logs').insert({
      tournament_id: selectedTournamentId,
      player_id: currentPlayer.id,
      bidding_team_id: team.id,
      bid_amount: amount
    });
    if (logError) return setMessage(logError.message);

    const { error } = await supabase
      .from('tournament_settings')
      .update({ current_bid_amount: amount, current_highest_team_id: team.id })
      .eq('tournament_id', selectedTournamentId);
    if (error) setMessage(error.message);
  }

  async function markSold() {
    const saleTeam = highestTeam || teams.find((item) => item.id === Number(bidTeamId));
    if (!currentPlayer) return setMessage('Start an auction for a player first.');
    if (!saleTeam) return setMessage('Sold karne ke liye team select karo.');
    const soldPrice = Math.max(toNumber(settings.current_bid_amount), toNumber(bidAmount), toNumber(currentPlayer.base_price));
    const teamRemaining = calculatedTeamRemaining(saleTeam, players);
    const teamPlayerCount = calculatedTeamPlayerCount(saleTeam, players);
    if (soldPrice > teamRemaining) return setMessage('Sold price team remaining budget se jyada hai.');
    if (teamPlayerCount >= toNumber(saleTeam.max_players)) return setMessage('Selected team roster is full.');

    if (!highestTeam) {
      const { error: logError } = await supabase.from('auction_logs').insert({
        tournament_id: selectedTournamentId,
        player_id: currentPlayer.id,
        bidding_team_id: saleTeam.id,
        bid_amount: soldPrice
      });
      if (logError) return setMessage(logError.message);
    }

    const { error: playerError } = await supabase
      .from('players')
      .update({
        sold_status: 'Sold',
        final_bid_price: soldPrice,
        assigned_team_id: saleTeam.id
      })
      .eq('id', currentPlayer.id);
    if (playerError) return setMessage(playerError.message);

    const { error: teamError } = await supabase
      .from('teams')
      .update({
        remaining_budget: Math.max(0, toNumber(saleTeam.total_budget) - teamSpend(players, saleTeam.id) - soldPrice),
        current_player_count: teamPlayerCount + 1
      })
      .eq('id', saleTeam.id);
    if (teamError) return setMessage(teamError.message);

    const { error } = await supabase
      .from('tournament_settings')
      .update({ current_player_id: null, current_bid_amount: 0, current_highest_team_id: null })
      .eq('tournament_id', selectedTournamentId);
    if (error) return setMessage(error.message);
    setAuctionResult?.({
      status: 'Sold',
      playerName: currentPlayer.full_name,
      teamName: saleTeam.team_name,
      amount: soldPrice
    });
    setSelectedPlayerId('');
    setBidTeamId('');
    setBidAmount('');
    await loadAll();
    setMessage(`${currentPlayer.full_name} sold to ${saleTeam.team_name}.`);
  }

  async function markUnsold() {
    if (!currentPlayer) return setMessage('No active player to close.');
    const closedPlayer = currentPlayer;
    const unsoldPrice = Math.max(toNumber(settings.current_bid_amount), toNumber(currentPlayer.base_price));
    const { error: playerError } = await supabase
      .from('players')
      .update({ sold_status: 'Unsold', final_bid_price: null, assigned_team_id: null })
      .eq('id', currentPlayer.id);
    if (playerError) return setMessage(playerError.message);

    const { error } = await supabase
      .from('tournament_settings')
      .update({ current_player_id: null, current_bid_amount: 0, current_highest_team_id: null })
      .eq('tournament_id', selectedTournamentId);
    if (error) return setMessage(error.message);
    setAuctionResult?.({
      status: 'Unsold',
      playerName: closedPlayer.full_name,
      teamName: '',
      amount: unsoldPrice
    });
    setSelectedPlayerId('');
    setBidTeamId('');
    setBidAmount('');
    await loadAll();
    setMessage(`${closedPlayer.full_name} unsold.`);
  }

  return (
    <div className="auction-layout">
      <section className="panel live-card">
        <div className="live-topline">
          <span className="pulse" />
          <span>Live Auction Room</span>
        </div>
        <div className="live-player-summary">
          {auctionResult ? (
            <AuctionResultCard result={auctionResult} settings={settings} compact />
          ) : (
            <>
              <div className="live-player-photo">
                {previewPlayer ? <PlayerPhoto player={previewPlayer} size="xl" /> : <Gavel size={44} />}
              </div>
              <div>
                <h2>{previewPlayer?.full_name || 'Choose The Next Player'}</h2>
                <div className="player-category-line">
                  {[previewPlayer?.category, playerCriteria(previewPlayer)].filter(Boolean).join(' - ') || 'Select player to preview photo'}
                </div>
                <div className="bid-price">{formatMoney(settings.current_bid_amount || currentPlayer?.base_price || previewPlayer?.base_price || 0, settings.currency_mode)}</div>
                <div className="high-bidder">{highestTeam ? `Highest: ${highestTeam.team_name}` : 'Base price par first bid allowed hai'}</div>
              </div>
            </>
          )}
        </div>

        <div className="control-grid">
          <label>
            Criteria
            <select value={criteriaFilter} onChange={(e) => setCriteriaFilter(e.target.value)}>
              <option value="">All Criteria</option>
              {criteriaOptions.map((criteria) => (
                <option key={criteria} value={criteria}>{criteria}</option>
              ))}
            </select>
          </label>
          <label>
            Player
            <select
              value={selectedPlayerId}
              onChange={(e) => selectAuctionPlayer(e.target.value)}
            >
              <option value="">Select player</option>
              {filteredAvailablePlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {[player.full_name, player.category || 'Uncategorized', playerCriteria(player)].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bidding Team
            <select value={bidTeamId} onChange={(e) => setBidTeamId(e.target.value)}>
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_name} - {formatMoney(calculatedTeamRemaining(team, players), settings.currency_mode)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bid Amount
            <input
              inputMode="numeric"
              value={bidAmount}
              onChange={(e) => setBidAmount(numericText(e.target.value))}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" onClick={startAuction}>
            <Gavel size={18} /> Start
          </button>
          <button type="button" className="accent-button" onClick={selectRandomPlayer}>
            <Shuffle size={18} /> Random Player
          </button>
          <button className="accent-button" onClick={placeBid}>
            <WalletCards size={18} /> Place bid
          </button>
          <button className="success-button" onClick={markSold}>
            <Crown size={18} /> Sold
          </button>
          <button className="ghost-button inline" onClick={markUnsold}>
            Unsold
          </button>
        </div>
      </section>

      <AuctionLog logs={logs} settings={settings} />
    </div>
  );
}

function TeamsAdmin({ teams, players, settings, selectedTournamentId, setMessage }) {
  const [form, setForm] = useState(blankTeam);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [ownerPins, setOwnerPins] = useState({});
  const teamLimit = toNumber(settings.team_count, defaultTeamLimit);
  const teamsRemaining = Math.max(0, teamLimit - teams.length);

  useEffect(() => {
    async function loadOwnerPins() {
      const teamIds = teams.map((team) => team.id);
      if (!teamIds.length) {
        setOwnerPins({});
        return;
      }
      const { data, error } = await supabase
        .from('team_owner_credentials')
        .select('team_id, owner_pin')
        .in('team_id', teamIds);
      if (error) {
        setOwnerPins({});
        return;
      }
      setOwnerPins((data || []).reduce((map, item) => ({ ...map, [item.team_id]: item.owner_pin }), {}));
    }

    loadOwnerPins();
  }, [teams]);

  function resetTeamForm() {
    setForm(blankTeam);
    setEditingTeamId(null);
  }

  function editTeam(team) {
    setForm(teamToForm({
      ...team,
      owner_pin: ownerPins[team.id] || '',
      remaining_budget: calculatedTeamRemaining(team, players),
      current_player_count: calculatedTeamPlayerCount(team, players)
    }));
    setEditingTeamId(team.id);
  }

  async function saveTeam(event) {
    event.preventDefault();
    if (!editingTeamId && teams.length >= teamLimit) return setMessage('Configured team limit reached. Tournament settings me Teams limit badhao.');
    const totalBudget = toNumber(form.total_budget);
    const ownerMobile = digitsOnly(form.owner_mobile);
    const ownerPin = numericText(form.owner_pin) || ownerMobile.slice(-4);
    const maxPlayers = toNumber(form.max_players, defaultTeamLimit);
    if (maxPlayers <= 0) return setMessage('Max players 0 se jyada hona chahiye.');
    if (ownerMobile && ownerMobile.length !== 10) return setMessage('Owner mobile number 10 digit hona chahiye.');
    if (ownerMobile && ownerPin.length < 4) return setMessage('Owner PIN minimum 4 digit hona chahiye.');
    const payload = {
      team_name: form.team_name.trim(),
      owner_name: form.owner_name.trim(),
      owner_mobile: ownerMobile || null,
      total_budget: totalBudget,
      remaining_budget: editingTeamId ? toNumber(form.remaining_budget, totalBudget) : totalBudget,
      max_players: maxPlayers,
      current_player_count: editingTeamId ? toNumber(form.current_player_count, 0) : 0
    };

    const wasEditing = Boolean(editingTeamId);
    const { data, error } = editingTeamId
      ? await supabase.from('teams').update(payload).eq('id', editingTeamId).select('id').single()
      : await supabase.from('teams').insert({ tournament_id: selectedTournamentId, ...payload }).select('id').single();

    if (error) return setMessage(formatSaveError(error));
    const teamId = data?.id || editingTeamId;
    if (ownerMobile) {
      const { error: credentialError } = await supabase
        .from('team_owner_credentials')
        .upsert({ team_id: teamId, owner_pin: ownerPin }, { onConflict: 'team_id' });
      if (credentialError) {
        return setMessage(`Team saved, lekin owner login PIN save nahi hua. Supabase SQL Editor me database/add-team-owner-bidding.sql run karo. Detail: ${credentialError.message}`);
      }
      setOwnerPins((current) => ({ ...current, [teamId]: ownerPin }));
    }
    resetTeamForm();
    setMessage(wasEditing ? 'Team updated.' : 'Team added.');
  }

  async function deleteTeam(team) {
    const confirmed = window.confirm(`Delete "${team.team_name}" team?`);
    if (!confirmed) return;
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) return setMessage(error.message);
    if (editingTeamId === team.id) resetTeamForm();
    setMessage('Team deleted.');
  }

  async function deleteSelectedTeams(selectedTeams) {
    if (!selectedTeams.length) return false;
    const confirmed = window.confirm(`Delete ${selectedTeams.length} selected teams? Sold players se team assignment remove ho sakta hai.`);
    if (!confirmed) return false;
    const { error } = await supabase.from('teams').delete().in('id', selectedTeams.map((team) => team.id));
    if (error) {
      setMessage(error.message);
      return false;
    }
    if (selectedTeams.some((team) => team.id === editingTeamId)) resetTeamForm();
    setMessage(`${selectedTeams.length} teams deleted.`);
    return true;
  }

  return (
    <div className="two-column">
      <form className="panel form-panel" onSubmit={saveTeam}>
        <div className="section-title">
          <Users size={20} />
          <h2>{editingTeamId ? 'Edit Team' : 'Add Team'}</h2>
        </div>
        <label>
          Team Name
          <input value={form.team_name} onChange={(e) => setForm({ ...form, team_name: titleCase(e.target.value) })} required />
        </label>
        <label>
          Owner Name
          <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: titleCase(e.target.value) })} required />
        </label>
        <label>
          Owner Mobile Number
          <input
            inputMode="numeric"
            maxLength="10"
            value={form.owner_mobile}
            onChange={(e) => setForm({ ...form, owner_mobile: digitsOnly(e.target.value) })}
            placeholder="10 digit login mobile"
          />
        </label>
        <label>
          Owner Login PIN
          <input
            inputMode="numeric"
            value={form.owner_pin}
            onChange={(e) => setForm({ ...form, owner_pin: numericText(e.target.value).slice(0, 8) })}
            placeholder="Blank = mobile last 4 digit"
          />
        </label>
        <label>
          Total Budget
          <input inputMode="numeric" value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: numericText(e.target.value) })} required />
        </label>
        {editingTeamId && (
          <label>
            Remaining Budget
            <input inputMode="numeric" value={form.remaining_budget} onChange={(e) => setForm({ ...form, remaining_budget: numericText(e.target.value) })} required />
          </label>
        )}
        <label>
          Max Players
          <input
            inputMode="numeric"
            value={form.max_players}
            onChange={(e) => setForm({ ...form, max_players: numericText(e.target.value) })}
            placeholder={`Blank = ${defaultTeamLimit}`}
          />
        </label>
        {editingTeamId && (
          <label>
            Current Players
            <input inputMode="numeric" value={form.current_player_count} onChange={(e) => setForm({ ...form, current_player_count: numericText(e.target.value) })} required />
          </label>
        )}
        <div className="button-row">
          <button className="primary-button" disabled={!editingTeamId && teamsRemaining === 0}>
            {editingTeamId ? <Save size={18} /> : <Users size={18} />}
            {!editingTeamId && teamsRemaining === 0 ? 'Team Limit Reached' : editingTeamId ? 'Save Team' : `Add Team (${teamsRemaining} Slots Left)`}
          </button>
          {editingTeamId && (
            <button type="button" className="ghost-button inline" onClick={resetTeamForm}>
              <Plus size={18} /> New
            </button>
          )}
        </div>
      </form>

      <TeamTable teams={teams} players={players} settings={settings} onEdit={editTeam} onDelete={deleteTeam} onBulkDelete={deleteSelectedTeams} />
    </div>
  );
}

function PlayersAdmin({ players, teams, settings, selectedTournamentId, setMessage, loadAll }) {
  const [mode, setMode] = useState('table');
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [retainForm, setRetainForm] = useState({ player_id: '', team_id: '', retain_price: '' });
  const [busy, setBusy] = useState(false);

  function openAddForm() {
    setEditingPlayer(null);
    setMode('add');
  }

  function editPlayer(player) {
    setEditingPlayer(player);
    setMode('edit');
  }

  function closeForm() {
    setEditingPlayer(null);
    setMode('table');
  }

  async function savePlayer(form, files) {
    let stats;
    try {
      stats = JSON.parse(form.stats || '{}');
    } catch {
      stats = {};
    }

    setBusy(true);
    try {
      const photoData = files.photo ? await imageFileToPassportDataUrl(files.photo, files.photoCrop) : form.photo_url;
      const paymentData = files.payment ? await imageFileToCompressedDataUrl(files.payment, 900, 1100, 0.68) : form.payment_screenshot_url;
      const aadhaarData = files.aadhaar ? await imageFileToCompressedDataUrl(files.aadhaar, 900, 1100, 0.68) : form.aadhaar_card_url;

      const criteria = form.player_criteria.trim() || defaultPlayerCriteria;

      stats.photo_url = photoData || '';
      stats.player_criteria = criteria;
      stats.tshirt_size = form.tshirt_size;
      stats.tshirt_number = numericText(form.tshirt_number) || null;
      stats.paid_amount = toNumber(form.paid_amount);
      stats.payment_screenshot_url = paymentData || '';
      stats.aadhaar_card_url = aadhaarData || '';

      const payload = {
        tournament_id: selectedTournamentId,
        full_name: titleCase(form.full_name.trim()),
        mobile_number: digitsOnly(form.mobile_number),
        photo_url: photoData || null,
        base_price: toNumber(form.base_price),
        category: form.category.trim(),
        player_criteria: criteria,
        tshirt_size: form.tshirt_size,
        tshirt_number: numericText(form.tshirt_number) || null,
        stats
      };

      if (payload.mobile_number.length !== 10) {
        setMessage('Mobile number must be 10 digits.');
        return;
      }

      const { error } = editingPlayer
        ? await supabase.from('players').update(payload).eq('id', editingPlayer.id)
        : await supabase.from('players').insert(payload);

      if (error) throw error;
      if (editingPlayer?.sold_status === 'Sold' && editingPlayer.assigned_team_id) {
        const team = teams.find((item) => item.id === editingPlayer.assigned_team_id);
        const nextPlayers = players.map((player) =>
          player.id === editingPlayer.id
            ? { ...player, ...payload }
            : player
        );
        const { error: teamError } = await syncTeamBudgetFromPlayers(team, nextPlayers);
        if (teamError) throw teamError;
      }
      await loadAll?.();
      setMessage(editingPlayer ? 'Player updated.' : 'Player added.');
      closeForm();
    } catch (error) {
      setMessage(formatSaveError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deletePlayer(player) {
    const confirmed = window.confirm(`Delete "${player.full_name}" player?`);
    if (!confirmed) return;
    const deleted = await deletePlayers([player], 'Player deleted.');
    if (deleted && editingPlayer?.id === player.id) closeForm();
  }

  async function deleteSelectedPlayers(selectedPlayers) {
    if (!selectedPlayers.length) return false;
    const confirmed = window.confirm(`Delete ${selectedPlayers.length} selected players? Sold players delete karne par team budget aur player count bhi adjust hoga.`);
    if (!confirmed) return false;
    return deletePlayers(selectedPlayers, `${selectedPlayers.length} selected players deleted.`);
  }

  async function deletePlayers(selectedPlayers, successMessage) {
    const ids = selectedPlayers.map((player) => player.id);
    setBusy(true);
    try {
      const affectedTeamIds = selectedPlayers.reduce((map, player) => {
        if (player.sold_status !== 'Sold' || !player.assigned_team_id) return map;
        map[player.assigned_team_id] = true;
        return map;
      }, {});
      const remainingPlayers = players.filter((player) => !ids.includes(player.id));

      for (const teamId of Object.keys(affectedTeamIds)) {
        const team = teams.find((item) => item.id === Number(teamId));
        if (!team) continue;
        const { error: teamError } = await syncTeamBudgetFromPlayers(team, remainingPlayers);
        if (teamError) throw teamError;
      }

      if (ids.includes(settings.current_player_id)) {
        const { error: settingsError } = await supabase
          .from('tournament_settings')
          .update({ current_player_id: null, current_bid_amount: 0, current_highest_team_id: null })
          .eq('tournament_id', selectedTournamentId);
        if (settingsError) throw settingsError;
      }

      const { error } = await supabase.from('players').delete().in('id', ids);
      if (error) throw error;
      await loadAll?.();
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(formatSaveError(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function retainPlayer(event) {
    event.preventDefault();
    const player = players.find((item) => item.id === Number(retainForm.player_id));
    const team = teams.find((item) => item.id === Number(retainForm.team_id));
    const retainPrice = toNumber(retainForm.retain_price);
    const teamRemaining = calculatedTeamRemaining(team, players);
    const teamPlayerCount = calculatedTeamPlayerCount(team, players);

    if (!player) return setMessage('Retain karne ke liye player select karo.');
    if (!team) return setMessage('Retain karne ke liye team select karo.');
    if (player.sold_status === 'Sold') return setMessage('Ye player already sold/retained hai.');
    if (retainPrice <= 0) return setMessage('Retain price 0 se jyada hona chahiye.');
    if (retainPrice > teamRemaining) return setMessage(`${team.team_name} ke paas enough remaining budget nahi hai.`);
    if (teamPlayerCount >= toNumber(team.max_players)) return setMessage(`${team.team_name} ka roster full hai.`);

    setBusy(true);
    try {
      const { error: playerError } = await supabase
        .from('players')
        .update({
          sold_status: 'Sold',
          final_bid_price: retainPrice,
          assigned_team_id: team.id
        })
        .eq('id', player.id);
      if (playerError) throw playerError;

      const { error: teamError } = await supabase
        .from('teams')
        .update({
          remaining_budget: Math.max(0, toNumber(team.total_budget) - teamSpend(players, team.id) - retainPrice),
          current_player_count: teamPlayerCount + 1
        })
        .eq('id', team.id);
      if (teamError) throw teamError;

      const { error: logError } = await supabase.from('auction_logs').insert({
        tournament_id: selectedTournamentId,
        player_id: player.id,
        bidding_team_id: team.id,
        bid_amount: retainPrice
      });
      if (logError) throw logError;

      if (settings.current_player_id === player.id) {
        const { error: settingsError } = await supabase
          .from('tournament_settings')
          .update({ current_player_id: null, current_bid_amount: 0, current_highest_team_id: null })
          .eq('tournament_id', selectedTournamentId);
        if (settingsError) throw settingsError;
      }

      setRetainForm({ player_id: '', team_id: '', retain_price: '' });
      await loadAll?.();
      setMessage(`${player.full_name} retained by ${team.team_name}.`);
    } catch (error) {
      setMessage(formatSaveError(error));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const template = [
      ['full_name', 'mobile_number', 'photo_url', 'base_price', 'category', 'player_criteria', 'tshirt_size', 'tshirt_number', 'paid_amount', 'payment_screenshot_url', 'aadhaar_card_url', 'stats'],
      ['Virat Kohli', '9876543210', 'https://example.com/virat.jpg', '5000', 'Batter', 'Gold Player', 'M', '18', '1000', '', '', '{"runs":1200,"strike_rate":142}'],
      ['Jasprit Bumrah', '9876543211', '', '4500', 'Bowler', 'Icon Player', 'L', '93', '1000', '', '', '{"wickets":32,"economy":6.8}']
    ]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cpl-player-import-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadBlankTemplate() {
    const headers = ['full_name', 'mobile_number', 'photo_url', 'base_price', 'category', 'player_criteria', 'tshirt_size', 'tshirt_number', 'paid_amount', 'payment_screenshot_url', 'aadhaar_card_url', 'stats'];
    const rows = Array.from({ length: 40 }, () => headers.map(() => ''));
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cpl-blank-player-upload-list.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadPlayersList() {
    const teamNameById = teams.reduce((map, team) => ({ ...map, [team.id]: team.team_name }), {});
    const headers = [
      'full_name',
      'mobile_number',
      'category',
      'player_criteria',
      'base_price',
      'paid_amount',
      'sold_status',
      'final_bid_price',
      'assigned_team',
      'tshirt_size',
      'tshirt_number'
    ];
    const rows = players.map((player) => [
      player.full_name,
      player.mobile_number,
      player.category || '',
      playerCriteria(player),
      player.base_price || 0,
      playerMeta(player, 'paid_amount') || 0,
      player.sold_status || '',
      player.final_bid_price || '',
      teamNameById[player.assigned_team_id] || '',
      playerMeta(player, 'tshirt_size') || '',
      playerMeta(player, 'tshirt_number') || ''
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cpl-tournament-${selectedTournamentId || 'players'}-players-list.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function printBlankPlayerList() {
    const printableColumns = [
      'S.No',
      'Full Name',
      'Mobile Number',
      'Photo',
      'Category',
      'Criteria',
      'T-Shirt Size',
      'T-Shirt No',
      'Base Price',
      'Paid Amount',
      'Payment Screenshot',
      'Aadhaar Card',
      'Stats / Notes',
      'Signature'
    ];
    const rows = Array.from({ length: 30 }, (_, index) => index + 1);
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
    if (!popup) {
      setMessage('Print window blocked hai. Browser me popup allow karo.');
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>CPL Blank Player List</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 18px; color: #111; font-family: Arial, sans-serif; }
            .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
            h1 { margin: 0; font-size: 24px; }
            p { margin: 5px 0 0; font-size: 12px; color: #444; }
            .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 14px; font-size: 12px; }
            .box { min-height: 34px; border: 1px solid #222; padding: 8px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #222; padding: 7px 5px; height: 36px; font-size: 10px; vertical-align: middle; }
            th { background: #e9f7df; text-align: left; }
            .sno { width: 36px; text-align: center; }
            .note { margin-top: 10px; font-size: 11px; }
            @media print {
              body { padding: 10mm; }
              button { display: none; }
              th, td { height: 32px; }
            }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="margin-bottom:12px;padding:8px 12px;">Print</button>
          <div class="header">
            <div>
              <h1>${tournament?.name || 'CPL'} - Blank Player Registration List</h1>
              <p>Use this paper list for team/player data collection. Digital upload headers are: full_name, mobile_number, photo_url, base_price, category, player_criteria, tshirt_size, tshirt_number, paid_amount, payment_screenshot_url, aadhaar_card_url, stats.</p>
            </div>
            <p>Date: ____________</p>
          </div>
          <div class="meta">
            <div class="box">Team Name:</div>
            <div class="box">Owner Name:</div>
            <div class="box">Contact No:</div>
          </div>
          <table>
            <thead>
              <tr>${printableColumns.map((column, index) => `<th class="${index === 0 ? 'sno' : ''}">${column}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((row) => `<tr>${printableColumns.map((_, index) => `<td class="${index === 0 ? 'sno' : ''}">${index === 0 ? row : ''}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <p class="note">Category options: Batter, Bowler, All-rounder, Wicket Keeper. Criteria default Silver Player rahega; admin panel se Gold, Platinum, Diamond, Icon ya custom criteria change kiya ja sakta hai.</p>
        </body>
      </html>
    `);
    popup.document.close();
  }

  async function importPlayers(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);

    try {
      const rows = file.name.toLowerCase().endsWith('.csv')
        ? parseCsv(await file.text())
        : rowsToObjects(await readWorkbookRows(file));
      const payload = rows
        .map((row) => {
          const stats = parseStats(pickField(row, ['stats', 'statistics']));
          const photoUrl = String(pickField(row, ['photo_url', 'photo', 'image_url'])).trim();
          const criteria = titleCase(String(pickField(row, ['player_criteria', 'criteria', 'grade', 'player_grade'])).trim()) || defaultPlayerCriteria;
          const tshirtSize = String(pickField(row, ['tshirt_size', 't_shirt_size', 'shirt_size'])).trim().toUpperCase();
          const tshirtNumber = numericText(pickField(row, ['tshirt_number', 't_shirt_number', 'shirt_number', 'tshirt_no', 't_shirt_no']));
          const paidAmount = toNumber(pickField(row, ['paid_amount', 'paid', 'payment_amount']));
          const paymentUrl = String(pickField(row, ['payment_screenshot_url', 'payment_screenshot', 'payment_file'])).trim();
          const aadhaarUrl = String(pickField(row, ['aadhaar_card_url', 'aadhaar_card', 'adhar_card_url', 'adhar_card'])).trim();
          if (photoUrl) stats.photo_url = photoUrl;
          stats.player_criteria = criteria;
          if (tshirtSizes.includes(tshirtSize)) stats.tshirt_size = tshirtSize;
          if (tshirtNumber) stats.tshirt_number = tshirtNumber;
          stats.paid_amount = paidAmount;
          if (paymentUrl) stats.payment_screenshot_url = paymentUrl;
          if (aadhaarUrl) stats.aadhaar_card_url = aadhaarUrl;
          return {
            tournament_id: selectedTournamentId,
            full_name: titleCase(pickField(row, ['full_name', 'fullname', 'name'])),
            mobile_number: digitsOnly(pickField(row, ['mobile_number', 'mobile', 'phone'])),
            photo_url: photoUrl || null,
            base_price: toNumber(pickField(row, ['base_price', 'baseprice', 'price'])),
            category: String(pickField(row, ['category', 'player_category'])).trim() || 'All-rounder',
            player_criteria: criteria,
            tshirt_size: tshirtSizes.includes(tshirtSize) ? tshirtSize : null,
            tshirt_number: tshirtNumber || null,
            stats
          };
        })
        .filter((row) => row.full_name && row.mobile_number.length === 10);

      if (!payload.length) {
        setMessage('No valid rows found. Use the template headers.');
        return;
      }

      const { error } = await supabase.from('players').insert(payload);
      if (error) setMessage(error.message);
      else setMessage(`${payload.length} players imported.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <div className="stack">
      {mode === 'table' && (
        <>
          <div className="admin-list-header">
            <div className="section-title">
              <ListChecks size={20} />
              <h2>Players Table</h2>
            </div>
            <div className="button-row">
              <button className="accent-button" onClick={downloadPlayersList} disabled={!players.length}>
                <Download size={18} /> Download Players List
              </button>
              <button className="primary-button" onClick={openAddForm}>
                <Plus size={18} /> Add New Player
              </button>
            </div>
          </div>

          <section className="panel import-panel">
            <div className="section-title">
              <Upload size={20} />
              <h2>Bulk Import</h2>
            </div>
            <p>Upload CSV or XLSX with player photo, category, T-shirt size, T-shirt number, payment, price, and stats columns.</p>
            <div className="button-row">
              <button className="accent-button" onClick={downloadTemplate}>
                <Download size={18} /> Download Template CSV
              </button>
              <button className="ghost-button inline" onClick={downloadBlankTemplate}>
                <Download size={18} /> Download Blank CSV
              </button>
              <button className="ghost-button inline" onClick={printBlankPlayerList}>
                <Printer size={18} /> Print Blank List
              </button>
              <label className="file-button">
                <Upload size={18} />
                {busy ? 'Importing...' : 'Upload File'}
                <input type="file" accept=".csv,.xlsx" onChange={importPlayers} disabled={busy} />
              </label>
            </div>
          </section>

          <section className="panel retain-panel">
            <div className="section-title">
              <Crown size={20} />
              <h2>Retain Player</h2>
            </div>
            <form className="retain-form" onSubmit={retainPlayer}>
              <label>
                Player
                <select
                  value={retainForm.player_id}
                  onChange={(e) => {
                    const selectedPlayer = players.find((item) => item.id === Number(e.target.value));
                    setRetainForm({
                      ...retainForm,
                      player_id: e.target.value,
                      retain_price: selectedPlayer ? String(toNumber(selectedPlayer.final_bid_price || selectedPlayer.base_price)) : retainForm.retain_price
                    });
                  }}
                  required
                >
                  <option value="">Select player</option>
                  {players.filter((player) => player.sold_status !== 'Sold').map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.full_name} - {player.category || 'Player'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Team
                <select
                  value={retainForm.team_id}
                  onChange={(e) => setRetainForm({ ...retainForm, team_id: e.target.value })}
                  required
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name} - {formatMoney(calculatedTeamRemaining(team, players), settings.currency_mode)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Retain Price
                <input
                  inputMode="numeric"
                  value={retainForm.retain_price}
                  onChange={(e) => setRetainForm({ ...retainForm, retain_price: numericText(e.target.value) })}
                  required
                />
              </label>
              <button className="success-button" disabled={busy}>
                <Crown size={18} /> {busy ? 'Saving...' : 'Retain Player'}
              </button>
            </form>
          </section>

          <PlayerTable
            players={players}
            teams={teams}
            settings={settings}
            setMessage={setMessage}
            onEdit={editPlayer}
            onDelete={deletePlayer}
            onBulkDelete={deleteSelectedPlayers}
            onMessageMarked={loadAll}
          />
        </>
      )}

      {mode !== 'table' && (
        <PlayerEditorForm
          player={editingPlayer}
          busy={busy}
          onCancel={closeForm}
          onSave={savePlayer}
        />
      )}
    </div>
  );
}

function PlayerEditorForm({ player, busy, onCancel, onSave }) {
  const [form, setForm] = useState(playerToForm(player));
  const [photoFile, setPhotoFile] = useState(null);
  const [paymentFile, setPaymentFile] = useState(null);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(playerMeta(player, 'photo_url') || player?.photo_url || '');
  const [paymentPreview, setPaymentPreview] = useState('');
  const [aadhaarPreview, setAadhaarPreview] = useState('');
  const [photoCrop, setPhotoCrop] = useState(defaultPassportCrop);
  const fixedCriteriaSelected = playerCriteriaOptions.includes(form.player_criteria);
  const showPaidAmountField = Boolean(paymentFile || paymentPreview || form.payment_screenshot_url);

  function updatePhoto(file) {
    setPhotoFile(file || null);
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : playerMeta(player, 'photo_url') || player?.photo_url || '');
    setPhotoCrop(defaultPassportCrop);
  }

  function updatePaymentFile(file) {
    setPaymentFile(file || null);
    if (paymentPreview) URL.revokeObjectURL(paymentPreview);
    setPaymentPreview(filePreviewUrl(file));
  }

  function updateAadhaarFile(file) {
    setAadhaarFile(file || null);
    if (aadhaarPreview) URL.revokeObjectURL(aadhaarPreview);
    setAadhaarPreview(filePreviewUrl(file));
  }

  function submit(event) {
    event.preventDefault();
    onSave(form, { photo: photoFile, photoCrop, payment: paymentFile, aadhaar: aadhaarFile });
  }

  return (
    <form className="panel registration-form" onSubmit={submit}>
      <section className="registration-photo-panel">
        <div className="section-title">
          <Camera size={20} />
          <h2>{player ? 'Edit Player' : 'Add Player'}</h2>
        </div>
        <PhotoCropControl preview={photoPreview} crop={photoCrop} onCropChange={setPhotoCrop} emptyIcon={<Camera size={36} />} />
        <label className="file-button wide">
          <Camera size={18} />
          Select Photo
          <input type="file" accept="image/*" onChange={(e) => updatePhoto(e.target.files?.[0] || null)} />
        </label>
      </section>

      <section className="form-panel nested-form">
        <div className="section-title">
          <User size={20} />
          <h2>Player Details</h2>
        </div>
        <label>
          Full Name
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: titleCase(e.target.value) })} required />
        </label>
        <label>
          Mobile Number
          <input inputMode="numeric" maxLength="10" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: digitsOnly(e.target.value) })} required />
        </label>
        <label>
          Base Price
          <input inputMode="numeric" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: numericText(e.target.value) })} required />
        </label>
        <label>
          Category
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {playerCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Player Criteria (Admin Only)
          <select
            value={fixedCriteriaSelected ? form.player_criteria : '__custom'}
            onChange={(e) => setForm({ ...form, player_criteria: e.target.value === '__custom' ? '' : e.target.value })}
          >
            {playerCriteriaOptions.map((criteria) => (
              <option key={criteria} value={criteria}>{criteria}</option>
            ))}
            <option value="__custom">Custom Criteria</option>
          </select>
        </label>
        {!fixedCriteriaSelected && (
          <label>
            Custom Criteria Name
            <input
              value={form.player_criteria}
              onChange={(e) => setForm({ ...form, player_criteria: titleCase(e.target.value) })}
              placeholder="Example: Super Gold Player"
            />
          </label>
        )}
        <label>
          T-Shirt Size
          <select value={form.tshirt_size} onChange={(e) => setForm({ ...form, tshirt_size: e.target.value })}>
            {tshirtSizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <label>
          T-Shirt No
          <input inputMode="numeric" value={form.tshirt_number} onChange={(e) => setForm({ ...form, tshirt_number: numericText(e.target.value) })} />
        </label>
      </section>

      <section className="form-panel nested-form">
        <div className="section-title">
          <FileImage size={20} />
          <h2>Payment Files</h2>
        </div>
        <label className="file-button wide">
          <Upload size={18} />
          Payment Screenshot
          <input type="file" accept="image/*" onChange={(e) => updatePaymentFile(e.target.files?.[0] || null)} />
        </label>
        <FilePreview title="Payment Screenshot" file={paymentFile} preview={paymentPreview} existing={form.payment_screenshot_url} />
        {showPaidAmountField && (
          <label>
            Paid Amount
            <input inputMode="numeric" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: numericText(e.target.value) })} />
          </label>
        )}
        <label className="file-button wide">
          <Upload size={18} />
          Aadhaar Card
          <input type="file" accept="image/*" onChange={(e) => updateAadhaarFile(e.target.files?.[0] || null)} />
        </label>
        <FilePreview title="Aadhaar Card" file={aadhaarFile} preview={aadhaarPreview} existing={form.aadhaar_card_url} />
        <div className="button-row">
          <button className="primary-button" disabled={busy}>
            <Save size={18} />
            {busy ? 'Saving...' : player ? 'Save Player' : 'Add Player'}
          </button>
          <button type="button" className="ghost-button inline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </form>
  );
}

async function readWorkbookRows(file) {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file, { getSheets: true });
  if (Array.isArray(sheets) && sheets[0]?.name) {
    return readXlsxFile(file, { sheet: sheets[0].name });
  }
  return readXlsxFile(file);
}

function MatchScoring({ tournament, selectedTournamentId, teams, players, settings, setMessage, canEdit = false }) {
  const [matches, setMatches] = useState([]);
  const [balls, setBalls] = useState([]);
  const [activeMatchId, setActiveMatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [matchForm, setMatchForm] = useState({
    match_title: '',
    venue: '',
    team_a_id: '',
    team_b_id: '',
    overs_limit: '10',
    toss_winner_team_id: '',
    toss_decision: 'Bat'
  });
  const [scoreForm, setScoreForm] = useState({
    striker_id: '',
    non_striker_id: '',
    bowler_id: '',
    wicket_type: 'Bowled',
    wicket_player_id: '',
    notes: ''
  });

  useEffect(() => {
    if (!selectedTournamentId) return;
    loadMatches();
  }, [selectedTournamentId]);

  useEffect(() => {
    if (!activeMatchId) {
      setBalls([]);
      return;
    }
    loadBalls(activeMatchId);
  }, [activeMatchId]);

  useEffect(() => {
    if (!selectedTournamentId) return undefined;
    const channel = supabase
      .channel(`cpl-match-scoring-${selectedTournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_balls' }, (payload) => {
        if (!activeMatchId || payload.new?.match_id === Number(activeMatchId) || payload.old?.match_id === Number(activeMatchId)) {
          loadBalls(activeMatchId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournamentId, activeMatchId]);

  const activeMatch = useMemo(
    () => matches.find((match) => match.id === Number(activeMatchId)) || matches[0] || null,
    [matches, activeMatchId]
  );

  useEffect(() => {
    if (!activeMatchId && matches[0]?.id) setActiveMatchId(String(matches[0].id));
  }, [matches, activeMatchId]);

  function getInningsSummary(deliveries) {
    return deliveries.reduce((summary, ball) => {
      const extraType = ball.extra_type || '';
      const legal = extraType !== 'Wide' && extraType !== 'No Ball';
      return {
        totalRuns: summary.totalRuns + toNumber(ball.runs) + toNumber(ball.extra_runs),
        wickets: summary.wickets + (ball.wicket_type ? 1 : 0),
        legalBalls: summary.legalBalls + (legal ? 1 : 0),
        extras: summary.extras + toNumber(ball.extra_runs)
      };
    }, { totalRuns: 0, wickets: 0, legalBalls: 0, extras: 0 });
  }

  const currentInningsNo = toNumber(activeMatch?.innings_no, 1);
  const currentInningsBalls = balls.filter((ball) => toNumber(ball.innings_no, 1) === currentInningsNo);
  const firstInningsBalls = balls.filter((ball) => toNumber(ball.innings_no, 1) === 1);
  const currentSummary = getInningsSummary(currentInningsBalls);
  const firstSummary = getInningsSummary(firstInningsBalls);
  const battingTeam = teams.find((team) => team.id === activeMatch?.batting_team_id);
  const bowlingTeam = teams.find((team) => team.id === activeMatch?.bowling_team_id);
  const teamA = teams.find((team) => team.id === activeMatch?.team_a_id);
  const teamB = teams.find((team) => team.id === activeMatch?.team_b_id);
  const currentOver = Math.floor(currentSummary.legalBalls / 6);
  const currentBall = currentSummary.legalBalls % 6;
  const target = toNumber(activeMatch?.target);
  const runsNeeded = currentInningsNo === 2 && target ? Math.max(0, target - currentSummary.totalRuns) : 0;
  const ballsLeft = currentInningsNo === 2
    ? Math.max(0, toNumber(activeMatch?.overs_limit, 0) * 6 - currentSummary.legalBalls)
    : 0;
  const runRate = currentSummary.legalBalls ? ((currentSummary.totalRuns * 6) / currentSummary.legalBalls).toFixed(2) : '0.00';
  const requiredRate = ballsLeft ? ((runsNeeded * 6) / ballsLeft).toFixed(2) : '0.00';

  function teamPlayers(teamId) {
    const roster = players.filter((player) => player.assigned_team_id === teamId);
    return roster.length ? roster : players;
  }

  function playerName(playerId) {
    return players.find((player) => player.id === Number(playerId))?.full_name || '-';
  }

  function teamName(teamId) {
    return teams.find((team) => team.id === Number(teamId))?.team_name || '-';
  }

  function battingCards(teamId, inningsNo) {
    return teamPlayers(teamId).map((player) => {
      const playerBalls = balls.filter((ball) => ball.innings_no === inningsNo && ball.striker_id === player.id);
      const runs = playerBalls.reduce((sum, ball) => {
        const extraType = ball.extra_type || '';
        if (extraType === 'Wide' || extraType === 'Bye' || extraType === 'Leg Bye') return sum;
        return sum + toNumber(ball.runs);
      }, 0);
      const legalBalls = playerBalls.filter((ball) => ball.extra_type !== 'Wide').length;
      const fours = playerBalls.filter((ball) => toNumber(ball.runs) === 4 && !['Wide', 'Bye', 'Leg Bye'].includes(ball.extra_type || '')).length;
      const sixes = playerBalls.filter((ball) => toNumber(ball.runs) === 6 && !['Wide', 'Bye', 'Leg Bye'].includes(ball.extra_type || '')).length;
      const wicket = balls.find((ball) => ball.innings_no === inningsNo && ball.wicket_player_id === player.id);
      return { player, runs, legalBalls, fours, sixes, wicket };
    }).filter((card) => card.legalBalls || card.runs || card.wicket);
  }

  function bowlingCards(teamId, inningsNo) {
    return teamPlayers(teamId).map((player) => {
      const bowlerBalls = balls.filter((ball) => ball.innings_no === inningsNo && ball.bowler_id === player.id);
      const legalBalls = bowlerBalls.filter((ball) => ball.extra_type !== 'Wide' && ball.extra_type !== 'No Ball').length;
      const runs = bowlerBalls.reduce((sum, ball) => {
        const extrasAgainstBowler = ['Wide', 'No Ball'].includes(ball.extra_type || '') ? toNumber(ball.extra_runs) : 0;
        const batRuns = ['Bye', 'Leg Bye'].includes(ball.extra_type || '') ? 0 : toNumber(ball.runs);
        return sum + batRuns + extrasAgainstBowler;
      }, 0);
      const wickets = bowlerBalls.filter((ball) => ['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit Wicket'].includes(ball.wicket_type || '')).length;
      const overs = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
      return { player, overs, runs, wickets, legalBalls };
    }).filter((card) => card.legalBalls || card.runs || card.wickets);
  }

  async function loadMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', selectedTournamentId)
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(friendlyScoringError(error));
      setMatches([]);
      return;
    }
    setMatches(data || []);
  }

  async function loadBalls(matchId = activeMatchId) {
    if (!matchId) return;
    const { data, error } = await supabase
      .from('score_balls')
      .select('*')
      .eq('match_id', Number(matchId))
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      setMessage(friendlyScoringError(error));
      setBalls([]);
      return;
    }
    setBalls(data || []);
  }

  function updateMatchForm(key, value) {
    setMatchForm((current) => ({ ...current, [key]: value }));
  }

  function updateScoreForm(key, value) {
    setScoreForm((current) => ({ ...current, [key]: value }));
  }

  async function createMatch(event) {
    event.preventDefault();
    if (!canEdit) return setMessage('Match scoring ke liye admin login required hai.');
    if (!matchForm.team_a_id || !matchForm.team_b_id) return setMessage('Dono teams select karo.');
    if (matchForm.team_a_id === matchForm.team_b_id) return setMessage('Team A aur Team B alag honi chahiye.');

    const tossWinnerId = Number(matchForm.toss_winner_team_id || matchForm.team_a_id);
    const teamAId = Number(matchForm.team_a_id);
    const teamBId = Number(matchForm.team_b_id);
    const tossLoserId = tossWinnerId === teamAId ? teamBId : teamAId;
    const battingTeamId = matchForm.toss_decision === 'Bat' ? tossWinnerId : tossLoserId;
    const bowlingTeamId = battingTeamId === teamAId ? teamBId : teamAId;
    const title = titleCase(matchForm.match_title || `${teamName(teamAId)} Vs ${teamName(teamBId)}`);

    setBusy(true);
    const { data, error } = await supabase
      .from('matches')
      .insert({
        tournament_id: selectedTournamentId,
        match_title: title,
        venue: titleCase(matchForm.venue || tournament?.address || ''),
        team_a_id: teamAId,
        team_b_id: teamBId,
        overs_limit: toNumber(matchForm.overs_limit, 10),
        toss_winner_team_id: tossWinnerId,
        toss_decision: matchForm.toss_decision,
        batting_team_id: battingTeamId,
        bowling_team_id: bowlingTeamId,
        innings_no: 1,
        status: 'Live'
      })
      .select('id')
      .single();
    setBusy(false);

    if (error) return setMessage(friendlyScoringError(error));
    setActiveMatchId(String(data.id));
    setMatchForm((current) => ({ ...current, match_title: '', venue: '' }));
    await loadMatches();
    setMessage('Match scoring start ho gaya.');
  }

  async function addDelivery({ runs = 0, extraType = '', extraRuns = 0, wicketType = '', wicketPlayerId = null }) {
    if (!canEdit) return setMessage('Scoring update ke liye admin login required hai.');
    if (!activeMatch) return setMessage('Pehle match create/select karo.');
    if (activeMatch.status === 'Completed') return setMessage('Completed match me scoring update nahi hogi.');
    if (!scoreForm.striker_id || !scoreForm.bowler_id) return setMessage('Striker aur bowler select karo.');
    const legalBalls = currentSummary.legalBalls + (extraType === 'Wide' || extraType === 'No Ball' ? 0 : 1);
    if (legalBalls > toNumber(activeMatch.overs_limit, 0) * 6) return setMessage('Overs limit complete ho chuki hai.');

    const payload = {
      tournament_id: selectedTournamentId,
      match_id: activeMatch.id,
      innings_no: currentInningsNo,
      over_no: currentOver,
      ball_no: currentBall + 1,
      batting_team_id: activeMatch.batting_team_id,
      bowling_team_id: activeMatch.bowling_team_id,
      striker_id: Number(scoreForm.striker_id),
      non_striker_id: scoreForm.non_striker_id ? Number(scoreForm.non_striker_id) : null,
      bowler_id: Number(scoreForm.bowler_id),
      runs,
      extra_type: extraType || null,
      extra_runs: extraRuns,
      wicket_type: wicketType || null,
      wicket_player_id: wicketPlayerId ? Number(wicketPlayerId) : null,
      notes: scoreForm.notes.trim() || null
    };

    const { error } = await supabase.from('score_balls').insert(payload);
    if (error) return setMessage(friendlyScoringError(error));

    if ((!extraType && runs % 2 === 1) || (legalBalls % 6 === 0 && legalBalls > currentSummary.legalBalls)) {
      setScoreForm((current) => ({
        ...current,
        striker_id: current.non_striker_id,
        non_striker_id: current.striker_id,
        notes: ''
      }));
    } else {
      setScoreForm((current) => ({ ...current, notes: '' }));
    }
    await loadBalls(activeMatch.id);
  }

  async function undoLastBall() {
    if (!canEdit) return setMessage('Undo ke liye admin login required hai.');
    const lastBall = [...balls].reverse().find((ball) => ball.innings_no === currentInningsNo);
    if (!lastBall) return setMessage('Undo ke liye ball record nahi mila.');
    const { error } = await supabase.from('score_balls').delete().eq('id', lastBall.id);
    if (error) return setMessage(friendlyScoringError(error));
    await loadBalls(activeMatch.id);
    setMessage('Last ball undo ho gayi.');
  }

  async function closeOrNextInnings() {
    if (!canEdit) return setMessage('Innings update ke liye admin login required hai.');
    if (!activeMatch) return;
    if (currentInningsNo === 1) {
      const { error } = await supabase
        .from('matches')
        .update({
          innings_no: 2,
          target: firstSummary.totalRuns + 1,
          batting_team_id: activeMatch.bowling_team_id,
          bowling_team_id: activeMatch.batting_team_id,
          status: 'Live'
        })
        .eq('id', activeMatch.id);
      if (error) return setMessage(friendlyScoringError(error));
      setScoreForm({ striker_id: '', non_striker_id: '', bowler_id: '', wicket_type: 'Bowled', wicket_player_id: '', notes: '' });
      await loadMatches();
      setMessage(`Second innings start. Target ${firstSummary.totalRuns + 1}.`);
      return;
    }

    const { error } = await supabase.from('matches').update({ status: 'Completed' }).eq('id', activeMatch.id);
    if (error) return setMessage(friendlyScoringError(error));
    await loadMatches();
    setMessage('Match completed.');
  }

  const battingRoster = teamPlayers(activeMatch?.batting_team_id);
  const bowlingRoster = teamPlayers(activeMatch?.bowling_team_id);

  return (
    <div className="stack match-scoring-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Match Scoring</p>
          <h1>{activeMatch?.match_title || tournament?.name || 'Professional Scoreboard'}</h1>
        </div>
        <span className={classNames('status-pill', activeMatch?.status === 'Completed' ? 'sold' : 'bidding')}>
          {activeMatch?.status || 'No Match'}
        </span>
      </header>

      {!selectedTournamentId && (
        <section className="panel table-panel">
          <p className="empty-text">Scoring start karne ke liye pehle tournament select karo.</p>
        </section>
      )}

      <div className="scoring-layout">
        <section className="panel score-live-panel">
          <div className="score-header">
            <div>
              <span>{battingTeam?.team_name || 'Batting Team'}</span>
              <strong>{currentSummary.totalRuns}/{currentSummary.wickets}</strong>
            </div>
            <div>
              <span>Overs</span>
              <strong>{currentOver}.{currentBall}/{activeMatch?.overs_limit || 0}</strong>
            </div>
            <div>
              <span>Run Rate</span>
              <strong>{runRate}</strong>
            </div>
          </div>

          <div className="score-match-line">
            <strong>{teamA?.team_name || 'Team A'} vs {teamB?.team_name || 'Team B'}</strong>
            <span>{bowlingTeam?.team_name ? `${bowlingTeam.team_name} bowling` : 'Create or select a match'}</span>
          </div>

          {currentInningsNo === 2 && (
            <div className="target-strip">
              <span>Target: {target}</span>
              <span>Need: {runsNeeded}</span>
              <span>Balls Left: {ballsLeft}</span>
              <span>Required RR: {requiredRate}</span>
            </div>
          )}

          <div className="metric-row">
            <Metric label="Innings" value={currentInningsNo} />
            <Metric label="Extras" value={currentSummary.extras} />
            <Metric label="First Innings" value={`${firstSummary.totalRuns}/${firstSummary.wickets}`} />
          </div>

          {canEdit && activeMatch && (
            <div className="scoring-controls">
              <div className="control-grid">
                <label>
                  Striker
                  <select value={scoreForm.striker_id} onChange={(e) => updateScoreForm('striker_id', e.target.value)}>
                    <option value="">Select striker</option>
                    {battingRoster.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                  </select>
                </label>
                <label>
                  Non Striker
                  <select value={scoreForm.non_striker_id} onChange={(e) => updateScoreForm('non_striker_id', e.target.value)}>
                    <option value="">Select non striker</option>
                    {battingRoster.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                  </select>
                </label>
                <label>
                  Bowler
                  <select value={scoreForm.bowler_id} onChange={(e) => updateScoreForm('bowler_id', e.target.value)}>
                    <option value="">Select bowler</option>
                    {bowlingRoster.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                  </select>
                </label>
              </div>

              <div className="run-pad" aria-label="Run buttons">
                {[0, 1, 2, 3, 4, 6].map((run) => (
                  <button type="button" className="score-run-button" key={run} onClick={() => addDelivery({ runs: run })}>
                    {run}
                  </button>
                ))}
              </div>

              <div className="button-row score-extra-row">
                <button type="button" className="accent-button small" onClick={() => addDelivery({ extraType: 'Wide', extraRuns: 1 })}>Wide +1</button>
                <button type="button" className="accent-button small" onClick={() => addDelivery({ extraType: 'No Ball', extraRuns: 1 })}>No Ball +1</button>
                <button type="button" className="ghost-button inline small" onClick={() => addDelivery({ extraType: 'Bye', extraRuns: 1 })}>Bye +1</button>
                <button type="button" className="ghost-button inline small" onClick={() => addDelivery({ extraType: 'Leg Bye', extraRuns: 1 })}>Leg Bye +1</button>
              </div>

              <div className="wicket-row">
                <label>
                  Wicket Type
                  <select value={scoreForm.wicket_type} onChange={(e) => updateScoreForm('wicket_type', e.target.value)}>
                    {['Bowled', 'Caught', 'Run Out', 'LBW', 'Stumped', 'Hit Wicket', 'Retired'].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Out Player
                  <select value={scoreForm.wicket_player_id} onChange={(e) => updateScoreForm('wicket_player_id', e.target.value)}>
                    <option value="">Default striker</option>
                    {battingRoster.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                  </select>
                </label>
                <label>
                  Note
                  <input value={scoreForm.notes} onChange={(e) => updateScoreForm('notes', titleCase(e.target.value))} placeholder="Catch by / short note" />
                </label>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => addDelivery({
                    runs: 0,
                    wicketType: scoreForm.wicket_type,
                    wicketPlayerId: scoreForm.wicket_player_id || scoreForm.striker_id
                  })}
                >
                  Wicket
                </button>
              </div>

              <div className="button-row">
                <button type="button" className="ghost-button inline" onClick={undoLastBall}>Undo Last Ball</button>
                <button type="button" className="success-button" onClick={closeOrNextInnings}>
                  {currentInningsNo === 1 ? 'Start Second Innings' : 'Complete Match'}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="panel table-panel match-setup-panel">
          <div className="section-title">
            <Trophy size={20} />
            <h2>Match Setup</h2>
          </div>

          <label>
            Select Match
            <select value={activeMatch?.id || ''} onChange={(e) => setActiveMatchId(e.target.value)}>
              <option value="">No match selected</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.match_title} - {match.status}
                </option>
              ))}
            </select>
          </label>

          {canEdit && (
            <form className="match-create-form" onSubmit={createMatch}>
              <label>
                Match Title
                <input value={matchForm.match_title} onChange={(e) => updateMatchForm('match_title', titleCase(e.target.value))} placeholder="Semi Final 1" />
              </label>
              <label>
                Venue
                <input value={matchForm.venue} onChange={(e) => updateMatchForm('venue', titleCase(e.target.value))} placeholder="Ground Name" />
              </label>
              <div className="control-grid two-fields">
                <label>
                  Team A
                  <select value={matchForm.team_a_id} onChange={(e) => updateMatchForm('team_a_id', e.target.value)} required>
                    <option value="">Select team</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                  </select>
                </label>
                <label>
                  Team B
                  <select value={matchForm.team_b_id} onChange={(e) => updateMatchForm('team_b_id', e.target.value)} required>
                    <option value="">Select team</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                  </select>
                </label>
              </div>
              <div className="control-grid two-fields">
                <label>
                  Overs
                  <input inputMode="numeric" value={matchForm.overs_limit} onChange={(e) => updateMatchForm('overs_limit', numericText(e.target.value))} required />
                </label>
                <label>
                  Toss Winner
                  <select value={matchForm.toss_winner_team_id} onChange={(e) => updateMatchForm('toss_winner_team_id', e.target.value)}>
                    <option value="">Team A default</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                  </select>
                </label>
              </div>
              <div className="segmented full-segment">
                {['Bat', 'Bowl'].map((decision) => (
                  <button
                    type="button"
                    key={decision}
                    className={classNames(matchForm.toss_decision === decision && 'active')}
                    onClick={() => updateMatchForm('toss_decision', decision)}
                  >
                    {decision}
                  </button>
                ))}
              </div>
              <button className="primary-button" disabled={busy}>
                <Plus size={18} /> {busy ? 'Starting...' : 'Create Match'}
              </button>
            </form>
          )}
        </aside>
      </div>

      <div className="scoring-layout">
        <section className="panel table-panel">
          <div className="section-title">
            <ListChecks size={20} />
            <h2>Scorecard</h2>
          </div>
          <div className="scorecard-grid">
            <ScorecardTable title={`${battingTeam?.team_name || 'Batting'} Batting`} rows={battingCards(activeMatch?.batting_team_id, currentInningsNo)} />
            <BowlingTable title={`${bowlingTeam?.team_name || 'Bowling'} Bowling`} rows={bowlingCards(activeMatch?.bowling_team_id, currentInningsNo)} />
          </div>
        </section>

        <section className="panel log-panel">
          <div className="section-title">
            <Activity size={20} />
            <h2>Ball By Ball</h2>
          </div>
          <div className="log-list">
            {[...currentInningsBalls].reverse().slice(0, 18).map((ball) => (
              <div className="log-item" key={ball.id}>
                <div>
                  <strong>{ball.over_no}.{ball.ball_no} - {playerName(ball.striker_id)}</strong>
                  <span>
                    {ball.wicket_type
                      ? `${ball.wicket_type}: ${playerName(ball.wicket_player_id)}`
                      : ball.extra_type
                        ? `${ball.runs + ball.extra_runs} (${ball.extra_type})`
                        : `${ball.runs} run`}
                  </span>
                </div>
                <b>{ball.runs + ball.extra_runs}</b>
              </div>
            ))}
            {!currentInningsBalls.length && <p className="empty-text">No scoring records yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function ScorecardTable({ title, rows }) {
  return (
    <div className="mini-score-table">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player.id}>
                <td>{row.player.full_name}</td>
                <td>{row.runs}</td>
                <td>{row.legalBalls}</td>
                <td>{row.fours}</td>
                <td>{row.sixes}</td>
                <td>{row.wicket ? row.wicket.wicket_type : 'Not Out'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="6">No batting record yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BowlingTable({ title, rows }) {
  return (
    <div className="mini-score-table">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>R</th>
              <th>W</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player.id}>
                <td>{row.player.full_name}</td>
                <td>{row.overs}</td>
                <td>{row.runs}</td>
                <td>{row.wickets}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="4">No bowling record yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectorView({ teams, players, settings, currentPlayer, highestTeam, logs, auctionResult }) {
  return (
    <div className="projector">
      <div className={classNames('scoreboard', auctionResult && 'result-mode', !auctionResult && !currentPlayer && 'standby-mode')}>
        {auctionResult ? (
          <AuctionResultCard result={auctionResult} settings={settings} />
        ) : (
          <>
            <div>
              <p className="eyebrow">{currentPlayer ? 'Now Bidding' : 'Auction Standby'}</p>
              {currentPlayer && <PlayerPhoto player={currentPlayer} size="xl" />}
              <h1>{currentPlayer?.full_name || 'Choose The Next Player'}</h1>
              <span>
                {[currentPlayer?.category, playerCriteria(currentPlayer)].filter(Boolean).join(' - ') || 'Waiting for auctioneer'}
              </span>
            </div>
            <div className="mega-price">{formatMoney(settings.current_bid_amount || currentPlayer?.base_price || 0, settings.currency_mode)}</div>
            <div className="winner-strip">{highestTeam ? highestTeam.team_name : currentPlayer ? 'No bid yet' : 'Ready for next player'}</div>
          </>
        )}
      </div>
      <div className="projector-grid">
        <AuctionLog logs={logs.slice(0, 8)} settings={settings} />
        <TeamTable teams={teams} players={players} settings={settings} compact />
      </div>
    </div>
  );
}

function PlayerDashboard({ player, teams, settings, logs, logout }) {
  const assignedTeam = teams.find((team) => team.id === player.assigned_team_id);

  return (
    <div className="stack player-dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">Player Dashboard</p>
          <h1>{player.full_name}</h1>
        </div>
        <button className="ghost-button inline" onClick={logout}>
          <LogOut size={17} /> Logout
        </button>
      </header>
      <div className="player-grid">
        <section className="panel profile-panel">
          <PlayerPhoto player={player} size="xl" />
          <span className={classNames('status-pill', player.sold_status?.toLowerCase())}>{player.sold_status}</span>
          <h2>{player.category || 'Player'}</h2>
          <div className="metric-row">
            <Metric label="Base Price" value={formatMoney(player.base_price, settings.currency_mode)} />
            <Metric label="Final Price" value={soldPlayerPrice(player) ? formatMoney(soldPlayerPrice(player), settings.currency_mode) : 'Pending'} />
            <Metric label="Team" value={assignedTeam?.team_name || 'Not assigned'} />
            <Metric label="Criteria" value={playerCriteria(player) || '-'} />
            <Metric label="T-Shirt Size" value={playerMeta(player, 'tshirt_size') || '-'} />
            <Metric label="T-Shirt No" value={playerMeta(player, 'tshirt_number') || '-'} />
          </div>
        </section>
        <AuctionLog logs={logs} settings={settings} />
      </div>
    </div>
  );
}

function TeamOwnerDashboard({
  ownerTeam,
  settings,
  teams = [],
  players,
  logs,
  currentPlayer,
  highestTeam,
  ownerPasses = [],
  selectedTournamentId,
  ownerSession,
  setOwnerSession,
  setMessage,
  loadAll,
  logout
}) {
  const [bidAmount, setBidAmount] = useState('');
  const team = ownerTeam || ownerSession;
  const teamId = team?.team_id || team?.id;
  const displayTeam = team ? { ...team, id: teamId } : null;
  const ownerRemaining = calculatedTeamRemaining(displayTeam, players);
  const ownerPlayerCount = calculatedTeamPlayerCount(displayTeam, players);
  const teamRoster = players.filter((player) => player.assigned_team_id === teamId);
  const teamLogs = logs.filter((log) => log.bidding_team_id === teamId);
  const currentPrice = Math.max(toNumber(settings.current_bid_amount), toNumber(currentPlayer?.base_price));
  const hasHighestBid = Boolean(settings.current_highest_team_id);
  const isHighest = settings.current_highest_team_id === teamId;
  const hasPassed = ownerPasses.some((pass) => pass.team_id === teamId);

  useEffect(() => {
    if (!currentPlayer) {
      setBidAmount('');
      return;
    }
    const nextSuggested = hasHighestBid ? currentPrice + bidIncrement : currentPrice;
    setBidAmount(String(nextSuggested || ''));
  }, [currentPlayer?.id, settings.current_bid_amount, settings.current_highest_team_id]);

  useEffect(() => {
    if (!teamId) return;
    const freshTeam = {
      ...ownerSession,
      ...team,
      team_id: teamId,
      remaining_budget: ownerRemaining,
      current_player_count: ownerPlayerCount
    };
    sessionStorage.setItem('cpl-owner-session', JSON.stringify(freshTeam));
    setOwnerSession(freshTeam);
  }, [teamId, ownerRemaining, ownerPlayerCount]);

  async function placeOwnerBid(event) {
    event.preventDefault();
    if (!currentPlayer) return setMessage('Abhi koi player live auction me nahi hai.');
    if (!teamId) return setMessage('Owner team session missing hai. Logout karke dobara login karo.');

    const amount = toNumber(bidAmount);
    if (isHighest) return setMessage(`${team.team_name} already highest bidder hai.`);
    const nextAllowed = hasHighestBid ? currentPrice + bidIncrement : currentPrice;
    if (amount < nextAllowed) {
      return setMessage(hasHighestBid
        ? `Next bid minimum ${formatMoney(nextAllowed, settings.currency_mode)} hona chahiye.`
        : `First bid base price ${formatMoney(currentPrice, settings.currency_mode)} ya usse jyada ho sakta hai.`);
    }
    if (amount > ownerRemaining) return setMessage(`${team.team_name} ke paas enough remaining budget nahi hai.`);
    if (ownerPlayerCount >= toNumber(team.max_players)) return setMessage(`${team.team_name} ka roster full hai.`);

    const { error } = await supabase.rpc('team_owner_place_bid', {
      selected_tournament_id: selectedTournamentId,
      owner_team_id: teamId,
      phone: ownerSession.owner_mobile,
      pin: ownerSession.owner_pin || '',
      selected_player_id: currentPlayer.id,
      amount
    });

    if (error) {
      setMessage(`Owner bid save nahi hua. Supabase SQL Editor me database/add-team-owner-bidding.sql run karo. Detail: ${error.message}`);
      return;
    }

    await loadAll?.();
    setMessage(`${team.team_name} ka bid ${formatMoney(amount, settings.currency_mode)} place ho gaya.`);
  }

  async function passOwnerBid() {
    if (!currentPlayer) return setMessage('Abhi koi player live auction me nahi hai.');
    if (!teamId) return setMessage('Owner team session missing hai. Logout karke dobara login karo.');
    if (isHighest) return setMessage('Aap highest bidder ho, pass allowed nahi hai.');
    const { data, error } = await supabase.rpc('team_owner_pass_bid', {
      selected_tournament_id: selectedTournamentId,
      owner_team_id: teamId,
      phone: ownerSession.owner_mobile,
      pin: ownerSession.owner_pin || '',
      selected_player_id: currentPlayer.id
    });
    if (error) {
      setMessage(`Pass save nahi hua. Supabase SQL Editor me database/add-owner-pass-bidding.sql run karo. Detail: ${error.message}`);
      return;
    }
    await loadAll?.();
    setMessage(data?.[0]?.player_unsold ? `${currentPlayer.full_name} unsold ho gaya.` : `${team.team_name} pass ho gaya.`);
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team Owner Room</p>
          <h1>{team?.team_name || 'Owner Bidding'}</h1>
        </div>
      </header>

      <div className="auction-layout">
        <section className="panel live-card owner-bid-card">
          <div className="live-topline">
            <span className="pulse" />
            <span>Live Bidding Access</span>
          </div>
          <div className="live-player-summary">
            <div className="live-player-photo">
              {currentPlayer ? <PlayerPhoto player={currentPlayer} size="xl" /> : <Gavel size={44} />}
            </div>
            <div>
              <h2>{currentPlayer?.full_name || 'Auction Standby'}</h2>
              <div className="player-category-line">{currentPlayer?.category || 'Admin live player start karega'}</div>
              <div className="bid-price">{formatMoney(currentPrice, settings.currency_mode)}</div>
              <div className="high-bidder">{highestTeam ? `Highest: ${highestTeam.team_name}` : 'Base price par first bid allowed hai'}</div>
            </div>
          </div>

          <div className="metric-row">
            <Metric label="Remaining Purse" value={formatMoney(ownerRemaining, settings.currency_mode)} />
            <Metric label="Roster" value={`${ownerPlayerCount}/${team?.max_players || 0}`} />
            <Metric label="Next Allowed" value={formatMoney(hasHighestBid ? currentPrice + bidIncrement : currentPrice, settings.currency_mode)} />
          </div>

          <form className="owner-bid-form" onSubmit={placeOwnerBid}>
            <label>
              Bid Amount
              <input
                inputMode="numeric"
                value={bidAmount}
                onChange={(e) => setBidAmount(numericText(e.target.value))}
                disabled={!currentPlayer || isHighest}
                required
              />
            </label>
            <button className="accent-button owner-place-bid" disabled={!currentPlayer || isHighest}>
              <WalletCards size={20} />
              {isHighest ? 'Already Highest' : 'Place Bid'}
            </button>
            <button type="button" className="danger-button owner-place-bid" onClick={passOwnerBid} disabled={!currentPlayer || isHighest || hasPassed}>
              <X size={20} />
              {hasPassed ? 'Passed' : 'Pass'}
            </button>
          </form>
          <p className="pass-note">{ownerPasses.length}/{teams.length} teams pass</p>
        </section>

        <section className="panel table-panel owner-team-panel">
          <div className="section-title">
            <Trophy size={20} />
            <h2>My Team</h2>
          </div>
          <div className="owner-team-card">
            <strong>{team?.owner_name || 'Team Owner'}</strong>
            <span>{team?.owner_mobile || 'Mobile not set'}</span>
          </div>
          <div className="roster-list owner-roster">
            {teamRoster.length ? teamRoster.map((player) => (
              <span key={player.id}>{player.full_name} - {formatMoney(soldPlayerPrice(player), settings.currency_mode)}</span>
            )) : <small>No players drafted yet</small>}
          </div>
          <div className="owner-log-block">
            <div className="section-title">
              <Activity size={18} />
              <h2>My Bid Log</h2>
            </div>
            <div className="log-list">
              {teamLogs.slice(0, 10).map((log) => (
                <div className="log-item" key={log.id}>
                  <div>
                    <strong>{log.players?.full_name || 'Player'}</strong>
                    <span>{log.teams?.team_name || team?.team_name || 'Team'}</span>
                  </div>
                  <b>{formatMoney(log.bid_amount, settings.currency_mode)}</b>
                </div>
              ))}
              {!teamLogs.length && <p className="empty-text">No bids by this team yet.</p>}
            </div>
          </div>
        </section>
      </div>
      <button className="ghost-button owner-bottom-logout" onClick={logout}>
        <LogOut size={17} /> Logout
      </button>
    </div>
  );
}

function Standings({ teams, players, settings }) {
  const sorted = [...teams].sort((a, b) => calculatedTeamRemaining(b, players) - calculatedTeamRemaining(a, players));

  return (
    <div className="standings-grid">
      {sorted.map((team, index) => {
        const roster = teamSoldRoster(players, team.id);
        const remaining = calculatedTeamRemaining(team, players);
        const rosterCount = calculatedTeamPlayerCount(team, players);
        return (
          <section className="panel standing-card" key={team.id}>
            <div className="rank">#{index + 1}</div>
            <h2>{team.team_name}</h2>
            <p>{team.owner_name}</p>
            <div className="budget-bar">
              <span style={{ width: `${Math.max(4, (remaining / Math.max(1, toNumber(team.total_budget))) * 100)}%` }} />
            </div>
            <div className="metric-row">
              <Metric label="Remaining" value={formatMoney(remaining, settings.currency_mode)} />
              <Metric label="Roster" value={`${rosterCount}/${team.max_players}`} />
            </div>
            <div className="roster-list">
              {roster.length ? roster.map((player) => <span key={player.id}>{player.full_name}</span>) : <small>No players drafted</small>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AuctionHistoryReport({ tournament, teams, players, settings }) {
  const soldPlayers = players.filter((player) => player.sold_status === 'Sold');
  const unsoldPlayers = players.filter((player) => player.sold_status !== 'Sold');
  const totalSpend = soldPlayers.reduce((sum, player) => sum + soldPlayerPrice(player), 0);
  const totalRemaining = teams.reduce((sum, team) => sum + calculatedTeamRemaining(team, players), 0);
  const teamReports = teams.map((team) => {
    const roster = teamSoldRoster(players, team.id);
    const spend = teamSpend(players, team.id);
    const remaining = calculatedTeamRemaining(team, players);
    return { team, roster, spend, remaining };
  });

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function downloadReportCsv() {
    const rows = [
      ['Report', tournament?.name || 'Tournament', '', '', '', '', '', ''],
      ['Total Players', players.length, 'Sold', soldPlayers.length, 'Unsold', unsoldPlayers.length, 'Total Spend', totalSpend],
      [],
      ['Team', 'Owner', 'Roster Count', 'Total Budget', 'Total Spend', 'Remaining Budget', 'Player', 'Final Price'],
      ...teamReports.flatMap(({ team, roster, spend, remaining }) => (
        roster.length
          ? roster.map((player) => [
            team.team_name,
            team.owner_name,
            roster.length,
            team.total_budget,
            spend,
            remaining,
            player.full_name,
            soldPlayerPrice(player)
          ])
          : [[team.team_name, team.owner_name, 0, team.total_budget, spend, remaining, 'No players', '']]
      )),
      [],
      ['Player', 'Mobile', 'Category', 'Criteria', 'Status', 'Base Price', 'Final Price', 'Assigned Team', 'T-Shirt Size'],
      ...players.map((player) => {
        const assignedTeam = teams.find((team) => team.id === player.assigned_team_id);
        return [
          player.full_name,
          player.mobile_number,
          player.category,
          playerCriteria(player),
          player.sold_status,
          player.base_price,
          soldPlayerPrice(player) || '',
          assignedTeam?.team_name || '',
          playerMeta(player, 'tshirt_size') || ''
        ];
      })
    ];

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(tournament?.name || 'auction-history').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="panel report-panel">
      <div className="report-header">
        <div>
          <p className="eyebrow">Auction History Report</p>
          <h2>{tournament?.name || 'Tournament Report'}</h2>
          <p>{formatDateRange(tournament?.start_date, tournament?.end_date)}</p>
        </div>
        <div className="button-row no-print">
          <button className="ghost-button inline" onClick={() => window.print()}>
            <Printer size={17} /> Print
          </button>
          <button className="accent-button" onClick={downloadReportCsv}>
            <Download size={17} /> Download CSV
          </button>
        </div>
      </div>

      <div className="report-summary">
        <Metric label="Total Players" value={players.length} />
        <Metric label="Sold Players" value={soldPlayers.length} />
        <Metric label="Unsold Players" value={unsoldPlayers.length} />
        <Metric label="Total Spend" value={formatMoney(totalSpend, settings.currency_mode)} />
        <Metric label="Remaining Purse" value={formatMoney(totalRemaining, settings.currency_mode)} />
      </div>

      <div className="report-section">
        <div className="section-title">
          <Trophy size={20} />
          <h2>Team-Wise Roster</h2>
        </div>
        <div className="report-team-grid">
          {teamReports.map(({ team, roster, spend, remaining }) => (
            <article className="report-team-card" key={team.id}>
              <div className="report-team-title">
                <div>
                  <strong>{team.team_name}</strong>
                  <span>{team.owner_name}</span>
                </div>
                <b>{formatMoney(spend, settings.currency_mode)}</b>
              </div>
              <div className="report-mini-row">
                <span>Players: {roster.length}/{team.max_players}</span>
                <span>Remaining: {formatMoney(remaining, settings.currency_mode)}</span>
              </div>
              <div className="report-roster-list">
                {roster.length ? roster.map((player) => (
                  <div key={player.id}>
                    <span>{player.full_name}</span>
                    <b>{formatMoney(soldPlayerPrice(player), settings.currency_mode)}</b>
                  </div>
                )) : <small>No players drafted</small>}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="report-section">
        <div className="section-title">
          <CheckCircle2 size={20} />
          <h2>Sold Players</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Category</th>
                <th>Criteria</th>
                <th>Team</th>
                <th>Base Price</th>
                <th>Sold Price</th>
              </tr>
            </thead>
            <tbody>
              {soldPlayers.map((player) => {
                const assignedTeam = teams.find((team) => team.id === player.assigned_team_id);
                return (
                  <tr key={player.id}>
                    <td>{player.full_name}</td>
                    <td>{player.category || '-'}</td>
                    <td>{playerCriteria(player) || '-'}</td>
                    <td>{assignedTeam?.team_name || '-'}</td>
                    <td>{formatMoney(player.base_price, settings.currency_mode)}</td>
                    <td>{formatMoney(soldPlayerPrice(player), settings.currency_mode)}</td>
                  </tr>
                );
              })}
              {!soldPlayers.length && (
                <tr>
                  <td colSpan="6">No sold players yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-section">
        <div className="section-title">
          <ListChecks size={20} />
          <h2>Unsold / Pending Players</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Mobile</th>
                <th>Category</th>
                <th>Criteria</th>
                <th>Status</th>
                <th>Base Price</th>
              </tr>
            </thead>
            <tbody>
              {unsoldPlayers.map((player) => (
                <tr key={player.id}>
                  <td>{player.full_name}</td>
                  <td>{player.mobile_number}</td>
                  <td>{player.category || '-'}</td>
                  <td>{playerCriteria(player) || '-'}</td>
                  <td>{player.sold_status}</td>
                  <td>{formatMoney(player.base_price, settings.currency_mode)}</td>
                </tr>
              ))}
              {!unsoldPlayers.length && (
                <tr>
                  <td colSpan="6">No unsold players.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TeamTable({ teams, players = [], settings, compact = false, onEdit, onDelete, onBulkDelete }) {
  const hasActions = Boolean(onEdit || onDelete);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectedCount = selectedIds.size;
  const allSelected = teams.length > 0 && teams.every((team) => selectedIds.has(team.id));

  function toggleSelected(teamId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) teams.forEach((team) => next.delete(team.id));
      else teams.forEach((team) => next.add(team.id));
      return next;
    });
  }

  async function deleteSelected() {
    if (!onBulkDelete) return;
    const selectedTeams = teams.filter((team) => selectedIds.has(team.id));
    const deleted = await onBulkDelete(selectedTeams);
    if (deleted) setSelectedIds(new Set());
  }

  return (
    <section className="panel table-panel">
      <div className="table-topbar">
        <div className="section-title">
          <Trophy size={20} />
          <h2>{hasActions ? 'Teams' : 'Team Standings'}</h2>
        </div>
        {hasActions && (
          <div className="table-tools">
            <label className="checkbox-line">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select All
            </label>
            <span className="summary-pill">{selectedCount} Selected</span>
            <button type="button" className="danger-button small" onClick={deleteSelected} disabled={!selectedCount}>
              <Trash2 size={15} /> Delete Selected
            </button>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {hasActions && <th>Select</th>}
              <th>Team</th>
              {!compact && <th>Owner</th>}
              {!compact && <th>Owner Login</th>}
              <th>Remaining</th>
              <th>Players</th>
              {hasActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const remaining = calculatedTeamRemaining(team, players);
              const rosterCount = calculatedTeamPlayerCount(team, players);
              return (
                <tr key={team.id}>
                  {hasActions && (
                    <td>
                      <input type="checkbox" checked={selectedIds.has(team.id)} onChange={() => toggleSelected(team.id)} />
                    </td>
                  )}
                  <td>{team.team_name}</td>
                  {!compact && <td>{team.owner_name}</td>}
                  {!compact && <td>{team.owner_mobile || 'Not set'}</td>}
                  <td>{formatMoney(remaining, settings.currency_mode)}</td>
                  <td>{rosterCount}/{team.max_players}</td>
                  {hasActions && (
                    <td>
                      <div className="mini-actions">
                        {onEdit && (
                          <button className="accent-button small" onClick={() => onEdit(team)}>
                            <Pencil size={15} /> Edit
                          </button>
                        )}
                        {onDelete && (
                          <button className="danger-button small" onClick={() => onDelete(team)}>
                            <Trash2 size={15} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!teams.length && (
              <tr>
                <td colSpan={(compact ? 3 : 5) + (hasActions ? 2 : 0)}>No teams added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerTable({ players, teams, settings, onEdit, onDelete, onBulkDelete, setMessage, onMessageMarked }) {
  const hasActions = Boolean(onEdit || onDelete);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBasePrice, setBulkBasePrice] = useState('');

  const filteredPlayers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) =>
      [player.full_name, player.mobile_number, player.category, playerCriteria(player), player.sold_status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [players, searchTerm]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = filteredPlayers.length > 0 && filteredPlayers.every((player) => selectedIds.has(player.id));
  const totalPaid = filteredPlayers.reduce((sum, player) => sum + toNumber(playerMeta(player, 'paid_amount')), 0);

  function toggleSelected(playerId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredPlayers.forEach((player) => next.delete(player.id));
      } else {
        filteredPlayers.forEach((player) => next.add(player.id));
      }
      return next;
    });
  }

  async function applyBulkBasePrice() {
    if (!setMessage) return;
    const amount = toNumber(bulkBasePrice);
    const ids = [...selectedIds].filter((id) => players.some((player) => player.id === id));
    if (!ids.length) return setMessage('Pehle players select karo.');
    if (!amount) return setMessage('Base price enter karo.');

    const { error } = await supabase.from('players').update({ base_price: amount }).in('id', ids);
    if (error) return setMessage(formatSaveError(error));
    setSelectedIds(new Set());
    setBulkBasePrice('');
    setMessage(`${ids.length} players ka base price update ho gaya.`);
  }

  async function deleteSelected() {
    if (!onBulkDelete) return;
    const selectedPlayers = players.filter((player) => selectedIds.has(player.id));
    if (!selectedPlayers.length) return setMessage?.('Pehle players select karo.');
    const deleted = await onBulkDelete(selectedPlayers);
    if (deleted) {
      setSelectedIds(new Set());
      setBulkBasePrice('');
    }
  }

  async function sendWhatsappMessage(player, type) {
    if (!setMessage) return;
    const phone = whatsappPhoneNumber(player.mobile_number);
    if (!phone || phone.length < 11) {
      setMessage('Player ka valid WhatsApp mobile number nahi hai.');
      return;
    }
    if (type === 'paid' && playerDueAmount(player) > 0) {
      setMessage('Abhi balance amount baki hai. Balance WhatsApp button use karo.');
      return;
    }
    if (type === 'due' && playerDueAmount(player) <= 0) {
      setMessage('Is player ka due amount nahi hai.');
      return;
    }

    const message = playerWhatsappMessage(player, type, settings);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      setMessage('WhatsApp popup blocked hai. Browser me popup allow karo.');
      return;
    }

    const confirmed = window.confirm('WhatsApp message send ho gaya? Yes karne par green tick save hoga.');
    if (!confirmed) {
      setMessage('WhatsApp tick save nahi hua.');
      return;
    }

    const stats = parseStats(player.stats);
    const whatsappMessages = {
      ...(stats.whatsapp_messages || {}),
      [type]: true,
      [`${type}_at`]: new Date().toISOString()
    };
    const { error } = await supabase
      .from('players')
      .update({ stats: { ...stats, whatsapp_messages: whatsappMessages } })
      .eq('id', player.id);

    if (error) {
      setMessage(formatSaveError(error));
      return;
    }

    await onMessageMarked?.();
    setMessage('WhatsApp message tick save ho gaya.');
  }

  return (
    <section className="panel table-panel">
      <div className="table-topbar">
        <div className="section-title">
          <ListChecks size={20} />
          <h2>Players</h2>
        </div>
        <div className="table-tools">
          <span className="summary-pill">Total Player: {filteredPlayers.length}</span>
          <span className="summary-pill">Total Paid: {formatMoney(totalPaid, settings.currency_mode)}</span>
          <label className="search-box">
            <Search size={17} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search player" />
          </label>
        </div>
      </div>
      {hasActions && (
        <div className="bulk-bar">
          <label className="checkbox-line">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            Select All
          </label>
          <span>{selectedCount} Selected</span>
          <input
            className="bulk-price-input"
            inputMode="numeric"
            value={bulkBasePrice}
            onChange={(e) => setBulkBasePrice(numericText(e.target.value))}
            placeholder="Base Price"
          />
          <button type="button" className="accent-button small" onClick={applyBulkBasePrice}>
            <Save size={15} /> Apply Base Price
          </button>
          <button type="button" className="danger-button small" onClick={deleteSelected} disabled={!selectedCount}>
            <Trash2 size={15} /> Delete Selected
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {hasActions && <th>Select</th>}
              <th>Name</th>
              <th>Photo</th>
              <th>Mobile</th>
              <th>Category</th>
              <th>Criteria</th>
              <th>T-Shirt</th>
              <th>Base</th>
              <th>Paid</th>
              <th>WA</th>
              <th>Files</th>
              <th>Status</th>
              <th>Team</th>
              {hasActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => {
              const team = teams.find((item) => item.id === player.assigned_team_id);
              const tshirtSize = playerMeta(player, 'tshirt_size');
              const tshirtNumber = playerMeta(player, 'tshirt_number');
              const paidAmount = playerMeta(player, 'paid_amount');
              const sentMap = whatsappSentMap(player);
              const dueAmount = playerDueAmount(player);
              return (
                <tr key={player.id}>
                  {hasActions && (
                    <td>
                      <input type="checkbox" checked={selectedIds.has(player.id)} onChange={() => toggleSelected(player.id)} />
                    </td>
                  )}
                  <td>{player.full_name}</td>
                  <td><PlayerPhoto player={player} size="table" /></td>
                  <td>{player.mobile_number}</td>
                  <td>{player.category || '-'}</td>
                  <td>{playerCriteria(player) || '-'}</td>
                  <td>{[tshirtSize, tshirtNumber && `#${tshirtNumber}`].filter(Boolean).join(' ') || '-'}</td>
                  <td>{formatMoney(player.base_price, settings.currency_mode)}</td>
                  <td>{paidAmount !== '' ? formatMoney(paidAmount, settings.currency_mode) : '-'}</td>
                  <td>
                    <div className="whatsapp-actions" aria-label={`${player.full_name} WhatsApp actions`}>
                      <WhatsAppActionButton
                        title="Registration WhatsApp"
                        sent={sentMap.registration}
                        onClick={() => sendWhatsappMessage(player, 'registration')}
                      >
                        <UserPlus size={15} />
                      </WhatsAppActionButton>
                      <WhatsAppActionButton
                        title="Payment Received WhatsApp"
                        sent={sentMap.paid}
                        disabled={playerRequiredAmount(player) <= 0 || dueAmount > 0}
                        onClick={() => sendWhatsappMessage(player, 'paid')}
                      >
                        <CheckCircle2 size={15} />
                      </WhatsAppActionButton>
                      <WhatsAppActionButton
                        title={dueAmount > 0 ? `Balance WhatsApp: ${formatMoney(dueAmount, settings.currency_mode)}` : 'No balance amount'}
                        sent={sentMap.due}
                        disabled={dueAmount <= 0}
                        onClick={() => sendWhatsappMessage(player, 'due')}
                      >
                        <BadgeIndianRupee size={15} />
                      </WhatsAppActionButton>
                    </div>
                  </td>
                  <td>
                    <div className="mini-actions">
                      <DataFileButton url={playerMeta(player, 'payment_screenshot_url')} label="Payment" />
                      <DataFileButton url={playerMeta(player, 'aadhaar_card_url')} label="Aadhaar" />
                    </div>
                  </td>
                  <td><span className={classNames('status-pill', player.sold_status?.toLowerCase())}>{player.sold_status}</span></td>
                  <td>{team?.team_name || '-'}</td>
                  {hasActions && (
                    <td>
                      <div className="mini-actions">
                        {onEdit && (
                          <button className="accent-button small" onClick={() => onEdit(player)}>
                            <Pencil size={15} /> Edit
                          </button>
                        )}
                        {onDelete && (
                          <button className="danger-button small" onClick={() => onDelete(player)}>
                            <Trash2 size={15} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!filteredPlayers.length && (
              <tr>
                <td colSpan={hasActions ? 14 : 12}>No players found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WhatsAppActionButton({ title, sent, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className={classNames('whatsapp-msg-button', sent && 'sent')}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      {sent && <span className="sent-check">✓</span>}
    </button>
  );
}

function DataFileButton({ url, label }) {
  const fileUrl = String(url || '');
  const [viewerUrl, setViewerUrl] = useState('');
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  async function openFile() {
    if (!fileUrl) return;
    try {
      if (fileUrl.startsWith('data:')) {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const nextUrl = URL.createObjectURL(blob);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setObjectUrl(nextUrl);
        setViewerUrl(nextUrl);
        return;
      }
      setViewerUrl(fileUrl);
    } catch {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  }

  function closeViewer() {
    setViewerUrl('');
  }

  return (
    <>
      <button type="button" className="ghost-button inline small" onClick={openFile} disabled={!fileUrl}>
        <FileImage size={15} /> {label}
      </button>
      {viewerUrl && (
        <div className="document-backdrop" role="dialog" aria-modal="true">
          <div className="document-dialog">
            <div className="document-header">
              <strong>{label}</strong>
              <button className="ghost-button inline small" onClick={closeViewer}>Close</button>
            </div>
            <img className="document-preview" src={viewerUrl} alt={`${label} preview`} />
          </div>
        </div>
      )}
    </>
  );
}

function AuctionLog({ logs, settings }) {
  return (
    <section className="panel log-panel">
      <div className="section-title">
        <Activity size={20} />
        <h2>Bid Log</h2>
      </div>
      <div className="log-list">
        {logs.map((log) => (
          <div className="log-item" key={log.id}>
            <div>
              <strong>{log.teams?.team_name || 'Team'}</strong>
              <span>{log.players?.full_name || 'Player'}</span>
            </div>
            <b>{formatMoney(log.bid_amount, settings.currency_mode)}</b>
          </div>
        ))}
        {!logs.length && <p className="empty-text">No bids yet.</p>}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <button className="toast" onClick={onClose}>
      {message}
    </button>
  );
}

export default App;
