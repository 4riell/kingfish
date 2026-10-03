// /js/conta.js
import { db, auth } from './firebase.js';
import { doc, updateDoc, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

window.openClientAccountModal = () => {
  const modal = document.getElementById("client-account-modal");
  if (modal) {
    modal.classList.add("open");
    if (window.currentClientData) {
      document.getElementById("client-profile-name").value = window.currentClientData.name || "";
      document.getElementById("client-profile-phone").value = window.currentClientData.phone || "";
      document.getElementById("client-order-count").innerText = window.currentClientData.orderCount || 0;
      
      const historyContainer = document.getElementById("client-orders-history");
      if (historyContainer) {
        historyContainer.innerHTML = "";
        if (window.currentClientData.savedOrders && window.currentClientData.savedOrders.length > 0) {
          window.currentClientData.savedOrders.forEach(order => {
            const dateStr = new Date(order.date).toLocaleDateString('pt-BR');
            historyContainer.innerHTML += `<div style="font-size:0.85rem; border-bottom:1px solid #eee; padding:5px 0;">Data: ${dateStr} - Total: R$ ${order.total.toFixed(2)} (${order.type})</div>`;
          });
        } else {
          historyContainer.innerHTML = `<p style="font-size:0.85rem; color:#777;">Nenhum pedido realizado ainda.</p>`;
        }
      }

      const couponsContainer = document.getElementById("client-coupons-list");
      if (couponsContainer) {
        couponsContainer.innerHTML = "";
        if (window.currentClientData.coupons && window.currentClientData.coupons.length > 0) {
          window.currentClientData.coupons.forEach(coupon => {
            couponsContainer.innerHTML += `<span style="display:inline-block; background:#eef2f5; padding:4px 8px; border-radius:4px; margin-right:5px; font-weight:bold; font-size:0.9rem;">${coupon}</span>`;
          });
        } else {
          couponsContainer.innerHTML = `<span style="font-size:0.85rem; color:#777;">Nenhum cupom disponível.</span>`;
        }
      }
      window.renderClientAddressesInAccount();
    }
  }
};

window.closeClientAccountModal = () => document.getElementById("client-account-modal")?.classList.remove("open");

window.updateClientProfile = async function(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Você precisa estar logado.");

  const newName = document.getElementById("client-profile-name").value;
  const newPhone = document.getElementById("client-profile-phone").value;

  try {
    const clientRef = doc(db, "clients", user.uid);
    await updateDoc(clientRef, { name: newName, phone: newPhone });
    window.currentClientData.name = newName;
    window.currentClientData.phone = newPhone;
    alert("Dados atualizados com sucesso!");
    window.closeClientAccountModal();
  } catch (error) {
    alert("Erro ao atualizar dados: " + error.message);
  }
};

window.clientLogout = async function() {
  try { await signOut(auth); window.closeClientAccountModal(); window.location.reload(); } 
  catch (error) { console.error("Erro ao sair:", error); }
};

window.openAddressModal = function(addressIndex = null) {
  const modal = document.getElementById("address-form-modal");
  const form = document.getElementById("address-form");
  if (form) form.reset();
  document.getElementById("address-index").value = addressIndex !== null ? addressIndex : "";
  if (addressIndex !== null && window.currentClientData?.addresses) {
    const addr = window.currentClientData.addresses[addressIndex];
    if (addr) {
      document.getElementById("addr-cep").value = addr.cep || "";
      document.getElementById("addr-cidade").value = addr.cidade || "";
      document.getElementById("addr-bairro").value = addr.bairro || "";
      document.getElementById("addr-rua").value = addr.rua || "";
      document.getElementById("addr-numero").value = addr.numero || "";
      document.getElementById("addr-complemento").value = addr.complemento || "";
      document.getElementById("addr-referencia").value = addr.referencia || "";
    }
  }
  modal?.classList.add("open");
};

window.closeAddressModal = () => document.getElementById("address-form-modal")?.classList.remove("open");

window.handleAddressSubmit = async function(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Você precisa estar logado.");

  const indexStr = document.getElementById("address-index").value;
  const newAddress = {
    cep: document.getElementById("addr-cep").value.trim(), cidade: document.getElementById("addr-cidade").value.trim(),
    bairro: document.getElementById("addr-bairro").value.trim(), rua: document.getElementById("addr-rua").value.trim(),
    numero: document.getElementById("addr-numero").value.trim(), complemento: document.getElementById("addr-complemento").value.trim(),
    referencia: document.getElementById("addr-referencia").value.trim()
  };

  let updatedAddresses = window.currentClientData?.addresses ? [...window.currentClientData.addresses] : [];
  if (indexStr === "") updatedAddresses.push(newAddress);
  else updatedAddresses[parseInt(indexStr)] = newAddress;

  try {
    const clientRef = doc(db, "clients", user.uid);
    await updateDoc(clientRef, { addresses: updatedAddresses });
    window.currentClientData.addresses = updatedAddresses;
    alert("Endereço salvo com sucesso!");
    window.closeAddressModal();
    window.openClientAccountModal();
  } catch (error) {
    alert("Erro ao salvar endereço: " + error.message);
  }
};

window.deleteAddress = async function(index) {
  if (!confirm("Deseja realmente excluir este endereço?")) return;
  const user = auth.currentUser;
  if (!user) return;
  let updatedAddresses = [...window.currentClientData.addresses];
  updatedAddresses.splice(index, 1);
  try {
    await updateDoc(doc(db, "clients", user.uid), { addresses: updatedAddresses });
    window.currentClientData.addresses = updatedAddresses;
    alert("Endereço excluído com sucesso!");
    window.openClientAccountModal();
  } catch (error) { alert("Erro ao excluir endereço: " + error.message); }
};

window.renderClientAddressesInAccount = function() {
  const container = document.getElementById("client-addresses-list");
  if (!container) return;
  const addresses = window.currentClientData?.addresses || [];
  if (addresses.length === 0) { container.innerHTML = `<p style="font-size:0.85rem; color:#777;">Nenhum endereço cadastrado.</p>`; return; }
  
  container.innerHTML = "";
  addresses.forEach((addr, idx) => {
    container.innerHTML += `
      <div style="border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 0.9rem; background: #fafafa;">
        <p><strong>${addr.rua}, Nº ${addr.numero}</strong> - ${addr.bairro}, ${addr.cidade}</p>
        <p style="color: #666; font-size: 0.8rem;">Ref: ${addr.referencia || 'Nenhuma'} | Comp: ${addr.complemento || 'Nenhum'}</p>
        <div style="margin-top: 6px; display: flex; gap: 10px;">
          <button type="button" onclick="openAddressModal(${idx})" style="background:none; border:none; color:#2980b9; cursor:pointer; font-weight:bold;">Editar</button>
          <button type="button" onclick="deleteAddress(${idx})" style="background:none; border:none; color:#c0392b; cursor:pointer; font-weight:bold;">Excluir</button>
        </div>
      </div>
    `;
  });
};

window.renderCheckoutSavedAddresses = function() {
  const select = document.getElementById("checkout-saved-addresses-select");
  if (!select) return;
  const addresses = window.currentClientData?.addresses || [];
  select.innerHTML = `<option value="">-- Cadastrar novo ou selecionar --</option>`;
  addresses.forEach((addr, idx) => { select.innerHTML += `<option value="${idx}">${addr.rua}, ${addr.numero} - ${addr.bairro}</option>`; });
  if (addresses.length > 0) {
    const lastIndex = addresses.length - 1; select.value = lastIndex; window.fillCheckoutWithAddress(lastIndex);
  }
};

window.onCheckoutAddressChange = function(selectElement) {
  const idx = selectElement.value;
  if (idx === "") {
    document.querySelectorAll("#delivery-fields input").forEach(input => { if(input.type === 'text') input.value = ''; });
  } else window.fillCheckoutWithAddress(parseInt(idx));
};

window.fillCheckoutWithAddress = function(index) {
  const addr = window.currentClientData?.addresses[index];
  if (!addr) return;
  document.getElementById("checkout-cep").value = addr.cep || ""; document.getElementById("checkout-cidade").value = addr.cidade || "";
  document.getElementById("checkout-bairro").value = addr.bairro || ""; document.getElementById("checkout-rua").value = addr.rua || "";
  document.getElementById("checkout-numero").value = addr.numero || ""; document.getElementById("checkout-complemento").value = addr.complemento || "";
  document.getElementById("checkout-referencia").value = addr.referencia || "";
};

window.openNewAddressForm = () => window.openAddressModal(null);

window.saveOrderToClientAccount = async function(orderData, totalValue, deliveryType, discountApplied = 0, couponCodeUsed = null) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, "clients", user.uid), {
      savedOrders: arrayUnion({ date: new Date().toISOString(), items: orderData, total: totalValue, type: deliveryType, discount: discountApplied, coupon: couponCodeUsed }),
      orderCount: increment(1)
    });
  } catch (error) { console.error("Erro ao salvar pedido na conta do cliente:", error); }
};