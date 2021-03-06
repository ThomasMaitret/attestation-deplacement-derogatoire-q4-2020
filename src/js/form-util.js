import removeAccents from 'remove-accents';

import { $, $$, downloadBlob } from './dom-utils';
import { addSlash, getFormattedDate } from './util';
import pdfBase from '../certificate.pdf';

const conditions = {
  '#field-firstname': {
    length: 1,
  },
  '#field-lastname': {
    length: 1,
  },
  '#field-birthday': {
    pattern: /^([0][1-9]|[1-2][0-9]|30|31)\/([0][1-9]|10|11|12)\/(19[0-9][0-9]|20[0-1][0-9]|2020)/g,
  },
  '#field-placeofbirth': {
    length: 1,
  },
  '#field-address': {
    length: 1,
  },
  '#field-city': {
    length: 1,
  },
  '#field-zipcode': {
    pattern: /\d{5}/g,
  },
  '#field-datesortie': {
    pattern: /\d{4}-\d{2}-\d{2}/g,
  },
  '#field-heuresortie': {
    pattern: /\d{2}:\d{2}/g,
  },
};

function validateAriaFields() {
  return Object.keys(conditions)
    .map((field) => {
      const fieldData = conditions[field];
      const pattern = fieldData.pattern;
      const length = fieldData.length;
      const isInvalidPattern = pattern && !$(field).value.match(pattern);
      const isInvalidLength = length && !$(field).value.length;

      const isInvalid = !!(isInvalidPattern || isInvalidLength);

      $(field).setAttribute('aria-invalid', isInvalid);
      if (isInvalid) {
        $(field).focus();
      }
      return isInvalid;
    })
    .includes(true);
}

export function setReleaseDateTime(releaseDateInput) {
  const loadedDate = new Date();
  releaseDateInput.value = getFormattedDate(loadedDate);
}
export function toAscii(string) {
  if (typeof string !== 'string') {
    throw new Error('Need string');
  }
  const accentsRemoved = removeAccents(string);
  const asciiString = accentsRemoved.replace(/[^\x00-\x7F]/g, ''); // eslint-disable-line no-control-regex
  return asciiString;
}
export function getProfile(formInputs) {
  const fields = {};
  for (const field of formInputs) {
    let value = field.value;
    if (field.id === 'field-datesortie') {
      const dateSortie = field.value.split('-');
      value = `${dateSortie[2]}/${dateSortie[1]}/${dateSortie[0]}`;
    }
    if (typeof value === 'string') {
      value = toAscii(value);
    }
    fields[field.id.substring('field-'.length)] = value;
  }
  return fields;
}

export function getReasons(reasonInputs) {
  const reasons = reasonInputs
    .filter((input) => input.checked)
    .map((input) => input.value)
    .join(', ');
  return reasons;
}

export function prepareInputs(
  formInputs,
  reasonInputs,
  reasonFieldset,
  reasonAlert
) {
  formInputs.forEach((input) => {
    const cachedValue = localStorage.getItem(input.name);
    if (cachedValue) {
      input.value = cachedValue;
    }

    const exempleElt = input.parentNode.parentNode.querySelector('.exemple');
    const validitySpan = input.parentNode.parentNode.querySelector('.validity');
    if (input.placeholder && exempleElt) {
      input.addEventListener('input', () => {
        if (input.value) {
          exempleElt.innerHTML = 'ex.&nbsp;: ' + input.placeholder;
          validitySpan.removeAttribute('hidden');
        } else {
          exempleElt.innerHTML = '';
        }
      });
    }
  });

  $('#field-birthday').addEventListener('keyup', function (event) {
    event.preventDefault();
    const input = event.target;
    const key = event.keyCode || event.charCode;
    if (key !== 8 && key !== 46) {
      input.value = addSlash(input.value);
    }
  });

  reasonInputs.forEach((radioInput) => {
    radioInput.addEventListener('change', function (event) {
      const isInError = reasonInputs.every((input) => !input.checked);
      reasonFieldset.classList.toggle('fieldset-error', isInError);
      reasonAlert.classList.toggle('hidden', !isInError);
    });
  });

  $('#generate-btn').addEventListener('click', async (event) => {
    event.preventDefault();

    const reasons = getReasons(reasonInputs);
    if (!reasons) {
      reasonFieldset.classList.add('fieldset-error');
      reasonAlert.classList.remove('hidden');
      reasonFieldset.scrollIntoView && reasonFieldset.scrollIntoView();
      return;
    }

    const invalid = validateAriaFields();
    if (invalid) {
      return;
    }

    import('./pdf-util').then(async ({ generatePdf }) => {
      const pdfBlob = await generatePdf(
        getProfile(formInputs),
        reasons,
        pdfBase
      );

      cacheFormValue(formInputs);

      const creationInstant = new Date();
      const creationDate = creationInstant.toLocaleDateString('fr-CA');
      const creationHour = creationInstant
        .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        .replace(':', '-');

      downloadBlob(pdfBlob, `attestation-${creationDate}_${creationHour}.pdf`);

      window.alert("L'attestation est téléchargée sur votre appareil.");
    });
  });
}

function cacheFormValue(formInputs) {
  formInputs.forEach((input) => {
    if (input.name !== 'datesortie' && input.name !== 'heuresortie') {
      localStorage.setItem(input.name, input.value);
    }
  });
}

export function prepareForm() {
  const formInputs = $$('#form-profile input');
  const reasonInputs = [...$$('input[name="field-reason"]')];
  const reasonFieldset = $('#reason-fieldset');
  const reasonAlert = reasonFieldset.querySelector('.msg-alert');
  const releaseDateInput = $('#field-datesortie');
  setReleaseDateTime(releaseDateInput);
  prepareInputs(formInputs, reasonInputs, reasonFieldset, reasonAlert);
}
