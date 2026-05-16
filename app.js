document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('order-form');
    const provinceSelect = document.getElementById('province');
    const citySelect = document.getElementById('city');
    const districtSelect = document.getElementById('district');
    const phoneInput = document.getElementById('phone');
    const packageRadios = document.querySelectorAll('input[name="package"]');
    const totalPriceEl = document.getElementById('total-price');
    const shippingDescEl = document.getElementById('shipping-desc');
    const submitBtn = document.querySelector('.submit-btn');
    
    const modal = document.getElementById('wechat-modal');
    const closeBtn = document.querySelector('.close-btn');
    const copyAgainBtn = document.getElementById('copy-again-btn');
    const wechatQrImage = document.getElementById('wechat-qr-image');
    const wechatTip = document.getElementById('wechat-tip');
    const phoneWechatTrigger = document.getElementById('phone-wechat-trigger');
    const contactModal = document.getElementById('contact-modal');
    const contactModalCloseBtn = document.querySelector('[data-close-contact]');

    let currentOrderInfo = '';
    let areaData = null;

    // Remote areas list (Only these will show "需咨询")
    const remoteProvinces = ['新疆维吾尔自治区', '西藏自治区', '黑龙江省', '吉林省'];
    // Exclude list (HK, Macau, Taiwan)
    const excludeProvinces = ['香港特别行政区', '澳门特别行政区', '台湾省'];

    // Prices mapping
    const prices = {
        '广东省': { '10': 158, '20': 258, desc: '广东省内包邮次日达' },
        '其他': { '10': 218, '20': 348, desc: '冷链空运加急 (外省)' }
    };
    const municipalityProvinces = ['北京市', '天津市', '上海市', '重庆市'];
    const qrConfigs = {
        default: {
            image: 'static/pic/wechat_lychee.jpg',
            wechatId: 'maoming_lychee'
        },
        cat: {
            image: 'static/pic/wechat_cat.jpg',
            wechatId: 'He-fangjie'
        }
    };
    const searchParams = new URLSearchParams(window.location.search);
    const qrKey = searchParams.get('qr');
    const currentQrConfig = qrConfigs[qrKey] || qrConfigs.default;

    const applyQrConfig = (config) => {
        if (wechatQrImage) {
            wechatQrImage.src = config.image;
        }
        if (wechatTip) {
            wechatTip.textContent = `微信号：${config.wechatId}`;
        }
    };

    applyQrConfig(currentQrConfig);

    // Load Area Data
    try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/china-area-data@5.0.1/data.json');
        areaData = await response.json();
        initAddressPicker();
        
        // Default to Guangdong
        provinceSelect.value = '广东省';
        provinceSelect.dispatchEvent(new Event('change'));
    } catch (err) {
        console.error('Failed to load area data', err);
    }

    function initAddressPicker() {
        const provinces = areaData['86'];
        for (const code in provinces) {
            const name = provinces[code];
            if (excludeProvinces.includes(name)) continue;

            const option = new Option(name, name);
            option.dataset.code = code;
            provinceSelect.add(option);
        }

        provinceSelect.addEventListener('change', () => {
            const selectedOption = provinceSelect.options[provinceSelect.selectedIndex];
            const code = selectedOption ? selectedOption.dataset.code : null;
            updateSelect(districtSelect, null, '请选择区域');
            updateSelect(citySelect, code, '请选择城市');
            calculatePrice();
        });

        citySelect.addEventListener('change', () => {
            const selectedOption = citySelect.options[citySelect.selectedIndex];
            const code = selectedOption ? selectedOption.dataset.code : null;
            updateSelect(districtSelect, code, '请选择区域');
        });
    }

    function updateSelect(selectEl, parentCode, placeholder) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        if (!parentCode || !areaData[parentCode]) return;

        const children = areaData[parentCode];
        const validOptions = [];
        let shixiaquCode = null;
        let shixiaquName = null;
        
        for (const code in children) {
            const name = children[code];
            if (name === '市辖区') {
                shixiaquCode = code;
                shixiaquName = name;
                continue;
            }
            validOptions.push({ code, name });
        }

        // Special case: Municipality (Beijing, etc.)
        // If there are NO other options except "市辖区", we auto-fill this level 
        // with the Province name and trigger the next level.
        if (validOptions.length === 0 && shixiaquCode) {
            const provinceName = provinceSelect.value;
            const option = new Option(provinceName, provinceName);
            option.dataset.code = shixiaquCode;
            selectEl.add(option);
            selectEl.selectedIndex = 1;
            selectEl.dispatchEvent(new Event('change'));
            return;
        }

        // For municipalities like Chongqing, keep the "市辖区" branch so urban districts remain selectable.
        if (selectEl === citySelect && shixiaquCode && validOptions.length > 0) {
            validOptions.unshift({
                code: shixiaquCode,
                name: municipalityProvinces.includes(provinceSelect.value) ? `${provinceSelect.value}城区` : shixiaquName
            });
        }

        validOptions.forEach(opt => {
            const option = new Option(opt.name, opt.name);
            option.dataset.code = opt.code;
            selectEl.add(option);
        });

        // Auto-select if only one option exists
        if (validOptions.length === 1) {
            selectEl.selectedIndex = 1;
            selectEl.dispatchEvent(new Event('change'));
        }
    }

    // Calculate price
    const calculatePrice = () => {
        const province = provinceSelect.value;
        const selectedPackage = document.querySelector('input[name="package"]:checked').value;
        
        if (!province) {
            totalPriceEl.textContent = '--';
            shippingDescEl.textContent = '请选择收货省份';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            return;
        }

        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';

        // Remote area check
        if (remoteProvinces.includes(province)) {
            totalPriceEl.textContent = '需咨询';
            shippingDescEl.textContent = '偏远地区暂不支持自动下单，请咨询掌柜';
            shippingDescEl.style.color = 'var(--primary-color)';
            return;
        }

        const priceKey = province === '广东省' ? '广东省' : '其他';
        const price = prices[priceKey][selectedPackage];
        const desc = prices[priceKey].desc;

        totalPriceEl.textContent = price;
        shippingDescEl.textContent = desc;
        
        if (province === '广东省') {
            shippingDescEl.style.color = 'var(--secondary-color)';
        } else {
            shippingDescEl.style.color = 'var(--primary-color)';
        }
    };

    const formatAddress = (province, city, district, detail) => {
        const parts = [province];
        if (city && city !== province) {
            parts.push(city);
        }
        if (district) {
            parts.push(district);
        }
        return `${parts.join('')}${detail ? ` ${detail}` : ''}`;
    };

    // Listeners for price change
    packageRadios.forEach(radio => {
        radio.addEventListener('change', calculatePrice);
    });

    // Copy to clipboard helper
    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                textArea.remove();
                if (!successful) throw new Error('copy failed');
            }
            return true;
        } catch (err) {
            console.error('Failed to copy!', err);
            return false;
        }
    };

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Phone validation
        const phone = phoneInput.value;
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            alert('请输入正确的11位手机号码');
            return;
        }

        const formData = new FormData(form);
        const name = formData.get('name');
        const provinceVal = formData.get('province');
        const cityVal = formData.get('city');
        const districtVal = formData.get('district');
        const address = formData.get('address');
        const pkg = formData.get('package');

        if (!provinceVal || !cityVal || !districtVal) {
            alert('请选择完整的收货地址');
            return;
        }
        
        const isRemote = remoteProvinces.includes(provinceVal);
        let priceText = '';
        let shippingType = '';

        if (isRemote) {
            priceText = '需咨询';
            shippingType = '偏远地区专线';
        } else {
            const priceKey = provinceVal === '广东省' ? '广东省' : '其他';
            priceText = `¥${prices[priceKey][pkg]}`;
            shippingType = prices[priceKey].desc;
        }

        const pageUrl = window.location.href;

        currentOrderInfo = `【荔枝购买订单】
品种：茂名禄段-白糖罂
规格：${pkg}斤装
收件人：${name}
电话：${phone}
地址：${formatAddress(provinceVal, cityVal, districtVal, address)}
物流：${shippingType}
预计金额：${priceText}

下单页面：${pageUrl}

请掌柜确认订单！`;

        await copyToClipboard(currentOrderInfo);
        modal.classList.add('show');
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    phoneWechatTrigger.addEventListener('click', () => {
        contactModal.classList.add('show');
    });
    contactModalCloseBtn.addEventListener('click', () => contactModal.classList.remove('show'));
    contactModal.addEventListener('click', (e) => { if (e.target === contactModal) contactModal.classList.remove('show'); });
    copyAgainBtn.addEventListener('click', async () => {
        if (await copyToClipboard(currentOrderInfo)) {
            const originalText = copyAgainBtn.textContent;
            copyAgainBtn.textContent = '复制成功！';
            setTimeout(() => copyAgainBtn.textContent = originalText, 2000);
        }
    });

    calculatePrice();
});
