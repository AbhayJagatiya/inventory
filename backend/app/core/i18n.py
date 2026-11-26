"""Backend Internationalization (i18n) Module for DSIMS.

Supports English ('en'), Hindi ('hi'), and Gujarati ('gu') via the
Accept-Language header or explicit language parameter.
"""

from contextvars import ContextVar
from typing import Dict, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

SUPPORTED_LANGUAGES = ("en", "hi", "gu")
DEFAULT_LANGUAGE = "en"

_request_lang_ctx: ContextVar[str] = ContextVar("request_language", default=DEFAULT_LANGUAGE)


def validate_language(lang: Optional[str]) -> str:
    """Validate and normalize a language code to 'en', 'hi', or 'gu'."""
    if not lang:
        return DEFAULT_LANGUAGE
    primary = lang.strip().lower().split("-")[0].split("_")[0]
    return primary if primary in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def parse_accept_language(header_value: Optional[str]) -> str:
    """Parse HTTP Accept-Language header and return best supported language."""
    if not header_value:
        return DEFAULT_LANGUAGE
    for part in header_value.split(","):
        code = part.split(";")[0].strip()
        validated = validate_language(code)
        if code and code.lower().split("-")[0].split("_")[0] in SUPPORTED_LANGUAGES:
            return validated
    return DEFAULT_LANGUAGE


def get_request_language() -> str:
    """Get the active language for the current request context."""
    return _request_lang_ctx.get()


def set_request_language(lang: str) -> None:
    """Set the active language in the current request context."""
    _request_lang_ctx.set(validate_language(lang))


class LanguageMiddleware(BaseHTTPMiddleware):
    """Extracts Accept-Language header and stores it in ContextVar."""

    async def dispatch(self, request: Request, call_next):
        lang = parse_accept_language(request.headers.get("Accept-Language"))
        token = _request_lang_ctx.set(lang)
        request.state.language = lang
        try:
            response = await call_next(request)
            response.headers["Content-Language"] = lang
            return response
        finally:
            _request_lang_ctx.reset(token)


# ---------------------------------------------------------------------------
# Error Code Translations
# ---------------------------------------------------------------------------

ERROR_MESSAGES: Dict[str, Dict[str, str]] = {
    "NOT_FOUND": {
        "en": "Resource not found",
        "hi": "संसाधन नहीं मिला",
        "gu": "સંસાધન મળ્યું નથી",
    },
    "CONFLICT": {
        "en": "Resource conflict or duplicate record",
        "hi": "संसाधन टकराव या डुप्लिकेट रिकॉर्ड",
        "gu": "સંસાધન વિરોધાભાસ અથવા ડુપ્લિકેટ રેકૉર્ડ",
    },
    "INSUFFICIENT_PERMISSIONS": {
        "en": "You do not have permission to perform this action",
        "hi": "आपको यह कार्यवाही करने की अनुमति नहीं है",
        "gu": "તમને આ કાર્યવાહી કરવાની પરવાનગી નથી",
    },
    "FORBIDDEN": {
        "en": "Access denied",
        "hi": "पहुँच अस्वीकृत",
        "gu": "પ્રવેશ નકાર્યો",
    },
    "OFFICE_ACCESS_DENIED": {
        "en": "Access to records outside your assigned office is prohibited",
        "hi": "आपके आवंटित कार्यालय के बाहर के रिकॉर्ड तक पहुँच प्रतिबंधित है",
        "gu": "તમારી ફાળવેલ કચેરીની બહારના રેકૉર્ડ્સની ઍક્સેસ પ્રતિબંધિત છે",
    },
    "UNAUTHORIZED": {
        "en": "Authentication required or invalid credentials",
        "hi": "प्रमाणीकरण आवश्यक है या अमान्य क्रेडेंशियल",
        "gu": "પ્રમાણીકરણ જરૂરી છે અથવા અમાન્ય ઓળખપત્રો",
    },
    "INVALID_TOKEN": {
        "en": "Invalid or expired authentication token",
        "hi": "अमान्य या समाप्त प्रमाणीकरण टोकन",
        "gu": "અમાન્ય અથવા સમાપ્ત થયેલ પ્રમાણીકરણ ટોકન",
    },
    "USER_NOT_FOUND": {
        "en": "User account not found",
        "hi": "उपयोगकर्ता खाता नहीं मिला",
        "gu": "વપરાશકર્તા ખાતું મળ્યું નથી",
    },
    "ACCOUNT_LOCKED": {
        "en": "User account is locked due to security policy",
        "hi": "सुरक्षा नीति के कारण उपयोगकर्ता खाता लॉक है",
        "gu": "સુરક્ષા નીતિને કારણે વપરાશકર્તા ખાતું લૉક છે",
    },
    "ACCOUNT_INACTIVE": {
        "en": "User account is deactivated",
        "hi": "उपयोगकर्ता खाता निष्क्रिय है",
        "gu": "વપરાશકર્તા ખાતું નિષ્ક્રિય છે",
    },
    "OFFICE_INACTIVE": {
        "en": "Assigned office is currently inactive",
        "hi": "आवंटित कार्यालय वर्तमान में निष्क्रिय है",
        "gu": "ફાળવેલ કચેરી હાલમાં નિષ્ક્રિય છે",
    },
    "INSUFFICIENT_STOCK": {
        "en": "Requested issue quantity exceeds available store balance",
        "hi": "अनुरोधित निर्गम मात्रा उपलब्ध भंडार शेष से अधिक है",
        "gu": "વિનંતી કરેલ નિર્ગમ જથ્થો ઉપલબ્ધ ભંડાર જથ્થા કરતાં વધુ છે",
    },
    "IMMUTABLE_RECORD": {
        "en": "Posted transaction records are immutable and cannot be modified or deleted",
        "hi": "पोस्ट किए गए लेन-देन रिकॉर्ड अपरिवर्तनीय हैं और इन्हें बदला या हटाया नहीं जा सकता",
        "gu": "નોંધાયેલા વ્યવહાર રેકૉર્ડ્સ અપરિવર્તનશીલ છે અને તેને બદલી કે કાઢી શકાતા નથી",
    },
    "VALIDATION_ERROR": {
        "en": "Request validation failed",
        "hi": "अनुरोध सत्यापन विफल रहा",
        "gu": "વિનંતી ચકાસણી નિષ્ફળ ગઈ",
    },
    "UNSUPPORTED_REPORT": {
        "en": "Unsupported report type requested",
        "hi": "असमर्थित रिपोर्ट प्रकार का अनुरोध किया गया",
        "gu": "અસમર્થિત અહેવાલ પ્રકારની વિનંતી કરવામાં આવી",
    },
    "INTERNAL_SERVER_ERROR": {
        "en": "An internal server error occurred",
        "hi": "आंतरिक सर्वर त्रुटि हुई",
        "gu": "આંતરિક સર્વર ભૂલ આવી",
    },
}


def get_localized_error_message(code: str, fallback: str, lang: Optional[str] = None) -> str:
    """Return localized error message for known error codes when lang != 'en'."""
    active_lang = validate_language(lang or get_request_language())
    if active_lang == "en":
        return fallback
    entry = ERROR_MESSAGES.get(code)
    if entry and active_lang in entry:
        return entry[active_lang]
    return fallback


# ---------------------------------------------------------------------------
# Report & Export Translations
# ---------------------------------------------------------------------------

ORG_NAMES = {
    "en": "District Development Office, Gir Somnath, Veraval",
    "hi": "जिला विकास कार्यालय, गिर सोमनाथ, वेरावल",
    "gu": "જિલ્લા વિકાસ કચેરી, ગીર સોમનાથ, વેરાવળ",
}

REPORT_META_LABELS = {
    "report": {"en": "Report", "hi": "रिपोर्ट", "gu": "અહેવાલ"},
    "official_register": {
        "en": "Official Government Register",
        "hi": "आधिकारिक शासकीय रजिस्टर",
        "gu": "સત્તાવાર સરકારી રજિસ્ટર",
    },
    "generated": {"en": "Generated", "hi": "निर्मित", "gu": "તૈયાર કર્યા સમય"},
}

REPORT_TITLES: Dict[str, Dict[str, str]] = {
    "stock-register": {
        "en": "Stock Register",
        "hi": "स्टॉक रजिस्टर",
        "gu": "સ્ટોક રજિસ્ટર",
    },
    "current-stock": {
        "en": "Stock Register",
        "hi": "स्टॉक रजिस्टर",
        "gu": "સ્ટોક રજિસ્ટર",
    },
    "asset-register": {
        "en": "Asset Register",
        "hi": "संपत्ति रजिस्टर",
        "gu": "સંપત્તિ રજિસ્ટર",
    },
    "stock-quantity": {
        "en": "Stock Quantity Summary",
        "hi": "स्टॉक मात्रा सारांश",
        "gu": "સ્ટોક જથ્થા સારાંશ",
    },
    "asset-valuation": {
        "en": "Asset Valuation Report",
        "hi": "संपत्ति मूल्यांकन रिपोर्ट",
        "gu": "સંપત્તિ મૂલ્યાંકન અહેવાલ",
    },
    "movements": {
        "en": "Stock Movement Report",
        "hi": "स्टॉक गतिविधि रिपोर्ट",
        "gu": "સ્ટોક હેરફેર અહેવાલ",
    },
    "dead-stock": {
        "en": "Dead Stock Report",
        "hi": "अनुपयोगी स्टॉक रिपोर्ट",
        "gu": "બિનઉપયોગી સ્ટોક અહેવાલ",
    },
    "condemnations": {
        "en": "Condemnation Report",
        "hi": "निंदा रिपोर्ट",
        "gu": "નિંદા અહેવાલ",
    },
    "disposals": {
        "en": "Disposal Report",
        "hi": "निपटान रिपोर्ट",
        "gu": "નિકાલ અહેવાલ",
    },
    "suppliers-procurement": {
        "en": "Suppliers & Procurement Report",
        "hi": "आपूर्तिकर्ता और खरीद रिपोर्ट",
        "gu": "સપ્લાયર્સ અને ખરીદી અહેવાલ",
    },
    "warranties": {
        "en": "Warranty Report",
        "hi": "वारंटी रिपोर्ट",
        "gu": "વૉરન્ટી અહેવાલ",
    },
    "maintenance": {
        "en": "Maintenance Report",
        "hi": "रख-रखाव रिपोर्ट",
        "gu": "જાળવણી અહેવાલ",
    },
    "physical-verification": {
        "en": "Physical Verification Report",
        "hi": "भौतिक सत्यापन रिपोर्ट",
        "gu": "ભૌતિક ચકાસણી અહેવાલ",
    },
}

COLUMN_HEADER_TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "Item Code": {"hi": "आइटम कोड", "gu": "વસ્તુ કોડ"},
    "Item Name": {"hi": "आइटम नाम", "gu": "વસ્તુનું નામ"},
    "Category": {"hi": "श्रेणी", "gu": "શ્રેણી"},
    "Location": {"hi": "स्थान", "gu": "સ્થળ"},
    "UOM": {"hi": "इकाई", "gu": "એકમ"},
    "Available Qty": {"hi": "उपलब्ध मात्रा", "gu": "ઉપલબ્ધ જથ્થો"},
    "Condition": {"hi": "स्थिति", "gu": "હાલત"},
    "Status": {"hi": "दर्जा", "gu": "સ્થિતિ"},
    "Asset Code": {"hi": "संपत्ति कोड", "gu": "સંપત્તિ કોડ"},
    "Name": {"hi": "नाम", "gu": "નામ"},
    "Serial No": {"hi": "क्रमांक", "gu": "ક્રમ નં."},
    "Purchase Date": {"hi": "खरीद तिथि", "gu": "ખરીદ તારીખ"},
    "Cost (₹)": {"hi": "मूल्य (₹)", "gu": "કિંમત (₹)"},
    "Supplier": {"hi": "आपूर्तिकर्ता", "gu": "સપ્લાયર"},
    "Custodian": {"hi": "अभिरक्षक", "gu": "કસ્ટોડિયન"},
    "Purchase Cost (₹)": {"hi": "खरीद मूल्य (₹)", "gu": "ખરીદ કિંમત (₹)"},
    "Age (Years)": {"hi": "आयु (वर्ष)", "gu": "ઉંમર (વર્ષ)"},
    "Depreciation Rate": {"hi": "मूल्यह्रास दर", "gu": "ઘસારા દર"},
    "Est. Depreciated Value (₹)": {"hi": "अनुमानित मूल्यह्रास मूल्य (₹)", "gu": "અંદાજિત ઘસારા બાદ મૂલ્ય (₹)"},
    "Voucher Number": {"hi": "वाउचर संख्या", "gu": "વાઉચર નંબર"},
    "Type": {"hi": "प्रकार", "gu": "પ્રકાર"},
    "Date": {"hi": "दिनांक", "gu": "તારીખ"},
    "Office": {"hi": "कार्यालय", "gu": "કચેરી"},
    "Recipient": {"hi": "प्राप्तकर्ता", "gu": "પ્રાપ્તકર્તા"},
    "Actor": {"hi": "कार्यकर्ता", "gu": "કર્મચારી"},
    "Classification": {"hi": "वर्गीकरण", "gu": "વર્ગીકરણ"},
    "Recorded Cost (₹)": {"hi": "दर्ज मूल्य (₹)", "gu": "નોંધાયેલ કિંમત (₹)"},
    "Days Inactive": {"hi": "निष्क्रिय दिन", "gu": "નિષ્ક્રિય દિવસ"},
    "Disposal No": {"hi": "निपटान नं.", "gu": "નિકાલ નં."},
    "Proposal No": {"hi": "प्रस्ताव नं.", "gu": "પ્રસ્તાવ નં."},
    "Method": {"hi": "विधि", "gu": "પદ્ધતિ"},
    "Proceeds (₹)": {"hi": "प्राप्त राशि (₹)", "gu": "ઉપજ (₹)"},
    "Buyer Agency": {"hi": "खरीदार एजेंसी", "gu": "ખરીદનાર એજન્સી"},
    "Order No": {"hi": "आदेश नं.", "gu": "આદેશ નં."},
    "Reason": {"hi": "कारण", "gu": "કારણ"},
    "Submitted By": {"hi": "जमाकर्ता", "gu": "સબમિટ કરનાર"},
    "Items Count": {"hi": "आइटम संख्या", "gu": "વસ્તુઓની સંખ્યા"},
}

ENUM_VALUE_TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "GOOD": {"hi": "अच्छी स्थिति", "gu": "સારી"},
    "FAIR": {"hi": "उचित स्थिति", "gu": "ઠીક"},
    "DAMAGED": {"hi": "क्षतिग्रस्त", "gu": "ક્ષતિગ્રસ્ત"},
    "SCRAP": {"hi": "रद्दी", "gu": "ભંગાર"},
    "AVAILABLE_IN_STORE": {"hi": "भंडार में उपलब्ध", "gu": "ભંડારમાં ઉપલબ્ધ"},
    "IN_USE": {"hi": "उपयोग में", "gu": "ઉપયોગમાં"},
    "UNDER_MAINTENANCE": {"hi": "रख-रखाव में", "gu": "જાળવણી હેઠળ"},
    "DISPATCHED_TO_VENDOR": {"hi": "विक्रेता को भेजा गया", "gu": "વિક્રેતાને મોકલેલ"},
    "PENDING_CONDEMNATION": {"hi": "निंदा लंबित", "gu": "નિંદા બાકી"},
    "PENDING_DISPOSAL": {"hi": "निपटान लंबित", "gu": "નિકાલ બાકી"},
    "DISPOSED": {"hi": "निपटाया गया", "gu": "નિકાલ કરેલ"},
    "ACTIVE": {"hi": "सक्रिय", "gu": "સક્રિય"},
    "SLOW_MOVING": {"hi": "धीमी गति", "gu": "ધીમી ગતિ"},
    "NON_MOVING": {"hi": "गैर-चलित", "gu": "બિન-ચલિત"},
    "OBSOLETE": {"hi": "अप्रचलित", "gu": "બિનઉપયોગી"},
    "DRAFT": {"hi": "मसौदा", "gu": "ડ્રાફ્ટ"},
    "POSTED": {"hi": "पोस्ट किया गया", "gu": "નોંધાયેલ"},
    "SUBMITTED": {"hi": "जमा किया गया", "gu": "સબમિટ કરેલ"},
    "UNDER_REVIEW": {"hi": "समीक्षाधीन", "gu": "સમીક્ષા હેઠળ"},
    "MORE_INFO_REQUIRED": {"hi": "अधिक जानकारी आवश्यक", "gu": "વધુ માહિતી જરૂરી"},
    "APPROVED": {"hi": "स्वीकृत", "gu": "મંજૂર"},
    "REJECTED": {"hi": "अस्वीकृत", "gu": "નામંજૂર"},
    "RECEIPT": {"hi": "रसीद", "gu": "આવક રસીદ"},
    "ISSUE": {"hi": "निर्गम", "gu": "જાવક / નિર્ગમ"},
    "RETURN": {"hi": "वापसी", "gu": "પરત"},
    "TRANSFER": {"hi": "स्थानांतरण", "gu": "ટ્રાન્સફર"},
    "PUBLIC_AUCTION": {"hi": "सार्वजनिक नीलामी", "gu": "જાહેર હરાજી"},
    "SCRAP_SALE": {"hi": "कबाड़ बिक्री", "gu": "ભંગાર વેચાણ"},
    "E_WASTE_RECYCLING": {"hi": "ई-अपशिष्ट पुनर्चक्रण", "gu": "ઈ-વેસ્ટ રિસાઇક્લિંગ"},
    "DESTRUCTION": {"hi": "नष्ट करना", "gu": "નાશ કરવો"},
}


def translate_report_header(header: str, lang: str) -> str:
    if lang == "en":
        return header
    return COLUMN_HEADER_TRANSLATIONS.get(header, {}).get(lang, header)


def translate_report_cell(value, lang: str):
    if lang == "en" or not isinstance(value, str):
        return value
    return ENUM_VALUE_TRANSLATIONS.get(value, {}).get(lang, value)


def get_report_title(report_name: str, lang: str) -> str:
    entry = REPORT_TITLES.get(report_name, {})
    return entry.get(lang) or entry.get("en") or report_name.replace("-", " ").title()
