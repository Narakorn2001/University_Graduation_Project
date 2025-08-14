import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Read config from window (populated by firebase-config.js)
const firebaseConfig = window.FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Elements
const formElement = document.getElementById("product-form");
const productIdInput = document.getElementById("product-id");
const productImagePathInput = document.getElementById("product-image-path");
const nameInput = document.getElementById("product-name");
const quantityInput = document.getElementById("product-quantity");
const priceInput = document.getElementById("product-price");
const imageInput = document.getElementById("product-image");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const exportCsvButton = document.getElementById("export-csv");
const searchInput = document.getElementById("search-input");
const productsTbody = document.getElementById("products-tbody");

// Helpers
function parseNumberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getQuantityClass(quantity) {
  if (quantity <= 5) return "low";
  if (quantity <= 10) return "mid";
  return "high";
}

function resetFormToCreateMode() {
  productIdInput.value = "";
  productImagePathInput.value = "";
  formElement.reset();
  submitButton.textContent = "เพิ่มสินค้า";
  cancelEditButton.hidden = true;
}

function switchToEditMode(product) {
  productIdInput.value = product.id;
  productImagePathInput.value = product.imagePath || "";
  nameInput.value = product.name || "";
  quantityInput.value = product.quantity ?? 0;
  priceInput.value = product.price ?? 0;
  submitButton.textContent = "อัปเดตสินค้า";
  cancelEditButton.hidden = false;
}

function createProductRow(product) {
  const tr = document.createElement("tr");

  const tdImage = document.createElement("td");
  const img = document.createElement("img");
  img.className = "product-image";
  img.alt = product.name || "product";
  img.src = product.imageUrl || "";
  tdImage.appendChild(img);

  const tdName = document.createElement("td");
  tdName.textContent = product.name || "-";

  const tdQty = document.createElement("td");
  const qtySpan = document.createElement("span");
  qtySpan.className = `qty ${getQuantityClass(product.quantity ?? 0)}`;
  qtySpan.textContent = String(product.quantity ?? 0);
  tdQty.appendChild(qtySpan);

  const tdPrice = document.createElement("td");
  tdPrice.textContent = (product.price ?? 0).toFixed(2);

  const tdActions = document.createElement("td");
  const editBtn = document.createElement("button");
  editBtn.className = "secondary";
  editBtn.textContent = "แก้ไข";
  editBtn.addEventListener("click", () => switchToEditMode(product));
  const delBtn = document.createElement("button");
  delBtn.className = "danger";
  delBtn.textContent = "ลบ";
  delBtn.addEventListener("click", async () => {
    const confirmed = confirm("ต้องการลบสินค้านี้หรือไม่?");
    if (!confirmed) return;
    await handleDeleteProduct(product);
  });
  tdActions.appendChild(editBtn);
  tdActions.appendChild(delBtn);

  tr.appendChild(tdImage);
  tr.appendChild(tdName);
  tr.appendChild(tdQty);
  tr.appendChild(tdPrice);
  tr.appendChild(tdActions);
  return tr;
}

async function uploadImageIfAny(productId) {
  const file = imageInput.files && imageInput.files[0];
  if (!file) return null;
  const storagePath = `products/${productId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { imageUrl: url, imagePath: storagePath };
}

async function handleDeleteImageIfExists(imagePath) {
  if (!imagePath) return;
  try {
    const storageRef = ref(storage, imagePath);
    await deleteObject(storageRef);
  } catch (_) { /* ignore if already deleted */ }
}

async function handleCreateOrUpdate(event) {
  event.preventDefault();
  const name = nameInput.value.trim();
  const quantity = parseNumberOrZero(quantityInput.value);
  const price = parseNumberOrZero(priceInput.value);
  if (!name) return;

  const productsCol = collection(db, "products");
  const existingId = productIdInput.value;

  if (existingId) {
    const productRef = doc(db, "products", existingId);
    const uploaded = await uploadImageIfAny(existingId);
    const updatePayload = {
      name,
      quantity,
      price,
      updatedAt: serverTimestamp()
    };
    if (uploaded) {
      // delete previous image if we are replacing
      await handleDeleteImageIfExists(productImagePathInput.value);
      updatePayload.imageUrl = uploaded.imageUrl;
      updatePayload.imagePath = uploaded.imagePath;
    }
    await updateDoc(productRef, updatePayload);
  } else {
    const createdRef = await addDoc(productsCol, {
      name,
      quantity,
      price,
      imageUrl: "",
      imagePath: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const uploaded = await uploadImageIfAny(createdRef.id);
    if (uploaded) {
      await updateDoc(createdRef, {
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.imagePath,
        updatedAt: serverTimestamp()
      });
    }
  }

  resetFormToCreateMode();
}

async function handleDeleteProduct(product) {
  await Promise.all([
    deleteDoc(doc(db, "products", product.id)),
    handleDeleteImageIfExists(product.imagePath)
  ]);
}

let cachedProducts = [];

function renderProductsList(list) {
  productsTbody.innerHTML = "";
  for (const product of list) {
    const row = createProductRow(product);
    productsTbody.appendChild(row);
  }
}

function handleSearch() {
  const q = (searchInput.value || "").trim().toLowerCase();
  if (!q) {
    renderProductsList(cachedProducts);
    return;
  }
  const filtered = cachedProducts.filter(p => (p.name || "").toLowerCase().includes(q));
  renderProductsList(filtered);
}

function setupRealtimeListener() {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
    cachedProducts = list;
    handleSearch();
  });
}

function convertToCsv(rows) {
  const header = ["Product Name", "Quantity", "Price", "Image URL"];
  const escape = (value) => {
    const s = String(value ?? "");
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      escape(r.name),
      escape(r.quantity),
      escape(Number(r.price).toFixed(2)),
      escape(r.imageUrl)
    ].join(","));
  }
  return lines.join("\n");
}

async function handleExportCsv() {
  const snap = await getDocs(collection(db, "products"));
  const rows = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    rows.push({
      name: data.name || "",
      quantity: data.quantity ?? 0,
      price: data.price ?? 0,
      imageUrl: data.imageUrl || ""
    });
  });
  const csv = convertToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `products_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Wire up events
formElement.addEventListener("submit", handleCreateOrUpdate);
cancelEditButton.addEventListener("click", resetFormToCreateMode);
exportCsvButton.addEventListener("click", handleExportCsv);
searchInput.addEventListener("input", handleSearch);

// Init
resetFormToCreateMode();
setupRealtimeListener();

