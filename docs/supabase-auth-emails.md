# Шаблоны писем Supabase Auth (бэкап)

> **Зачем этот файл.** Письма «подтверждение регистрации» и «сброс пароля» шлёт
> **Supabase Auth**, а не код проекта (`lib/email.ts` отвечает только за письма о
> заказах и заявки по VIN через Beget SMTP). Эти шаблоны живут в **дашборде
> Supabase → Authentication → Emails** и **НЕ попадают в `pg_dump`**. При любом
> переезде/смене проекта Supabase их нужно **пересоздать вручную**. Этот файл —
> их версионируемая копия, чтобы они не потерялись.

## Где в дашборде

`Supabase Dashboard → Authentication → Emails`:
- **Confirm sign up** — письмо подтверждения email при регистрации.
- **Reset password** — письмо сброса пароля.

Триггерятся из кода:
- регистрация → `supabase.auth.signUp()` ([app/auth/register/page.tsx](../app/auth/register/page.tsx))
- сброс пароля → `supabase.auth.resetPasswordForEmail()` ([app/auth/forgot-password/page.tsx](../app/auth/forgot-password/page.tsx))

## Чек-лист при переезде auth (чтобы не потерять)

1. Скопировать **Subject** и **Body (Source)** обоих шаблонов из этого файла в
   новый Supabase-проект / новую систему auth.
2. Проверить, что плейсхолдеры поддерживаются новой системой: `{{ .ConfirmationURL }}`
   (основной), также доступны `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`,
   `{{ .Email }}`, `{{ .Data }}`, `{{ .RedirectTo }}`.
3. Перенастроить **URL Configuration** (Site URL + Redirect URLs) и SMTP отправителя.
4. Отправить тестовое письмо регистрации и сброса, проверить вёрстку и ссылки.

---

## Confirm sign up

**Subject:** `Подтвердите регистрацию в BroCar`

**Body (Source):**

```html
<div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #ececec;border-radius:16px;overflow:hidden;">
      <div style="text-align:center;padding:28px 24px 18px;">
        <img src="https://brocarparts.ru/Logo_Brocar.webp" alt="BroCar" style="height:56px;width:auto;border-radius:8px;" />
      </div>
      <div style="height:3px;background:#ea580c;"></div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 14px;font-size:22px;color:#111111;">Подтвердите ваш email</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#555555;">
          Спасибо за регистрацию в <b>BroCar</b> — магазине автозапчастей.
          Чтобы активировать аккаунт, подтвердите свою почту, нажав на кнопку ниже.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 34px;border-radius:10px;">
            Подтвердить email
          </a>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#999999;">
          Если кнопка не работает, скопируйте эту ссылку в браузер:<br/>
          <a href="{{ .ConfirmationURL }}" style="color:#ea580c;word-break:break-all;">{{ .ConfirmationURL }}</a>
        </p>
        <p style="margin:18px 0 0;font-size:13px;color:#999999;">
          Если вы не регистрировались на BroCar — просто проигнорируйте это письмо.
        </p>
      </div>
      <div style="background:#fafafa;border-top:1px solid #ececec;padding:20px 32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#777777;font-weight:bold;">BroCar — автозапчасти</p>
        <p style="margin:0;font-size:12px;color:#aaaaaa;">
          Екатеринбург, ул. Заводская, 16 · +7 (932) 600-60-15<br/>
          <a href="https://brocarparts.ru" style="color:#ea580c;">brocarparts.ru</a>
        </p>
      </div>
    </div>
  </div>
</div>
```

---

## Reset password

**Subject:** `Восстановление пароля в BroCar`

**Body (Source):**

```html
<div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #ececec;border-radius:16px;overflow:hidden;">
      <div style="text-align:center;padding:28px 24px 18px;">
        <img src="https://brocarparts.ru/Logo_Brocar.webp" alt="BroCar" style="height:64px;width:auto;border-radius:50%;" />
      </div>
      <div style="height:3px;background:#ea580c;"></div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 14px;font-size:22px;color:#111111;">Сброс пароля</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#555555;">
          Мы получили запрос на сброс пароля для вашего аккаунта на <b>BroCar</b>.
          Нажмите кнопку ниже, чтобы задать новый пароль.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 34px;border-radius:10px;">
            Задать новый пароль
          </a>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#999999;">
          Если кнопка не работает, скопируйте эту ссылку в браузер:<br/>
          <a href="{{ .ConfirmationURL }}" style="color:#ea580c;word-break:break-all;">{{ .ConfirmationURL }}</a>
        </p>
        <p style="margin:18px 0 0;font-size:13px;color:#999999;">
          Если вы не запрашивали сброс пароля — проигнорируйте это письмо, ваш пароль останется прежним.
        </p>
      </div>
      <div style="background:#fafafa;border-top:1px solid #ececec;padding:20px 32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#777777;font-weight:bold;">BroCar — автозапчасти</p>
        <p style="margin:0;font-size:12px;color:#aaaaaa;">
          Екатеринбург, ул. Заводская, 16 · +7 (932) 600-60-15<br/>
          <a href="https://brocarparts.ru" style="color:#ea580c;">brocarparts.ru</a>
        </p>
      </div>
    </div>
  </div>
</div>
```
