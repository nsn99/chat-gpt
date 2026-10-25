# Приёмка 0.1 на реальном компьютере

Статус: модульные тесты пройдены; браузерная 3D-приёмка ожидает устройство с WebGL. Облачный браузер не предоставляет контекст WebGL, поэтому графика не объявлена проверенной.

## Сценарий

1. Запустить `npm start`, открыть localhost:3000. Видны пустыня, дорога и автомобиль за стартовым экраном. Нет графических артефактов и ошибок консоли.
2. Начать поездку. W разгоняет, S тормозит и включает задний ход, A/D поворачивают, пробел останавливает. На песке тяга и скорость ниже.
3. Нажать C, проверить вид из салона; кликнуть по сцене и повернуть мышь. Esc освобождает мышь и ставит игру на паузу. Повторный Esc или кнопка возвращает в игру.
4. Остановиться рядом с первой станцией на 70 м, нажать E. Пешком подойти к оранжевой канистре перед зданием. E увеличивает топливо максимум до 40 л и ремонтирует максимум до 100%. Повторный сбор запрещён.
5. Вернуться к машине, нажать E. Удариться в камень: состояние снижается. При нулевом топливе/состоянии газ не действует. R возвращает на дорогу и позволяет продолжить.
6. Сохранить P, перезагрузить страницу и продолжить. Машина, топливо, состояние и уже собранные припасы восстановлены; скорость обнулена. Новая поездка требует подтверждения перезаписи.
7. Переключить качество. Проверить на встроенной графике и окне небольшого размера. Замерить FPS отдельно; заявленного результата на Mac пока нет.
8. Доехать до 3 км: появляется завершение маршрута, кнопка позволяет продолжить движение. Смена вкладки ставит игру на паузу.

На первом прогоне записать модель GPU, браузер, разрешение, обычный/низкий режим, FPS и обнаруженные ошибки. Ручную проверку не заменять успехом CI.


## Мобильная версия 0.2

Проверено отдельно от WebGL: портретный HUD 390×844, альбомный HUD 844×390, меню 320×568, размеры и расположение кнопок, снятие нажатия после отпускания. Модульные тесты покрывают несколько указателей, одновременный газ/поворот и очистку состояния. Тестовая оболочка интерфейса не включается в сборку.

На реальном iPhone Safari и Android Chrome проверить: удержание газа с поворотом вторым пальцем, обзор третьим пальцем, отмену касания, смену ориентации, сворачивание/возврат, вырез экрана, работу сохранения и возврат к поездке. Для графики и FPS остаётся необходимым устройство с WebGL.

## 0.6 verification

59 Node tests pass, including vehicle swap/save persistence, fuel conservation, stopped-only tanker siphoning, servicing, endless travel at 3 km / 100 km / 1000 km, pedestrian swept collisions, damage cooldown, yielding/horn/wait/bypass in both directions, blocked bypass, persistent upgrades and camper recovery. Full prior steering/crash/touch regression suite remains green.

`npm run build` passed. World, particles and sky shader pairs compiled and linked in a local Mesa EGL OpenGL ES context. Rendered actual generated world geometry and the smoke particle pass to an offline image and inspected it. This caught and fixed vertex-interpolated fog washing the entire ground grey. The geometry remains within the fixed buffer budget, including buses and tankers.

Production HTML/CSS and main input/HUD handlers were checked in a separate ignored UI-only harness at 390×844 and 844×390. The harness deliberately substitutes an inert renderer because cloud-browser WebGL is unavailable; it is not evidence of in-browser 3D playability. Verified walking HUD, hidden brake, compact expanded controls and workshop dialog. No phone-device performance benchmark or full GPU browser driving playtest was performed.

Limitations: traffic avoidance is a local lane heuristic, ground stays flat, dunes use blocking footprints, projected ground shadows are approximate, housing is procedural, upgrades are predefined (no freeform construction), no flying vehicles, no articulated ragdoll. Effects and AI traffic are transient; parked/acquired vehicles, cargo fuel and upgrades persist. Long trips retain discovered vehicles in the save, so memory/save size grows with explored distance.
