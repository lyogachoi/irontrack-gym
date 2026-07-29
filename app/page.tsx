"use client";

import { useEffect, useMemo, useState } from "react";

type SetRow = { id: number; weight: number; reps: number; done: boolean };
type Exercise = { id: number; name: string; muscle: string; restSeconds: number; sets: SetRow[] };
type CompletedExercise = { name: string; muscle: string; sets: { weight: number; reps: number }[] };
type Session = { id: number; iso: string; date: string; title: string; volume: number; duration: number; exercises?: CompletedExercise[] };
type Template = { id: number; name: string; subtitle: string; exercises: Exercise[] };
type Measurement = { id: number; iso: string; weight: number; waist: number; chest: number; arm: number; photo?: string };
type SavedState = { templates: Template[]; activeTemplateId: number; history: Session[]; measurements: Measurement[] };
type ActiveWorkout = { templateId: number; exercises: Exercise[]; seconds: number; rest: number };
type CatalogExercise = {
  name: string; muscle: string; equipment: string; level: "Начальный" | "Средний";
  sheet: "chest" | "back" | "legs" | "arms" | "core"; slot: number;
  steps: [string, string, string]; mistakes: string;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const cloudSyncEnabled = process.env.NEXT_PUBLIC_CLOUD_SYNC !== "false";
const localIso = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const todayIso = () => localIso();
const formatDate = (iso: string) => new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`)).replace(".", "");
const setRows = (weights: number[][]) => weights.map((v, i) => ({ id: i + 1, weight: v[0], reps: v[1], done: false }));
const cloneExercises = (items: Exercise[]) => items.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, done: false })) }));

const exercise = (
  name: string, muscle: string, equipment: string, sheet: CatalogExercise["sheet"], slot: number,
  steps: CatalogExercise["steps"], mistakes: string, level: CatalogExercise["level"] = "Начальный",
): CatalogExercise => ({ name, muscle, equipment, sheet, slot, steps, mistakes, level });

const popularExercise = (
  name: string, muscle: string, equipment: string, sheet: CatalogExercise["sheet"], slot: number,
  setup: string, action: string, mistakes: string, level: CatalogExercise["level"] = "Начальный",
): CatalogExercise => exercise(name, muscle, equipment, sheet, slot, [
  setup,
  action,
  "Вернитесь в исходное положение медленно, сохраняя контроль и ровное дыхание.",
], mistakes, level);

const catalog: CatalogExercise[] = [
  exercise("Жим штанги лёжа","Грудь","Штанга · скамья","chest",0,["Сведите лопатки, упритесь стопами и снимите штангу.","Опустите гриф к нижней части груди, локти держите под углом около 45°.","Выжмите вверх без отрыва таза и потери положения лопаток."],"Не отбивайте штангу от груди и не разводите локти в одну линию с плечами.","Средний"),
  exercise("Жим гантелей на наклонной","Грудь","Гантели · наклонная скамья","chest",1,["Установите наклон 20–35°, прижмите лопатки к скамье.","Опустите гантели по сторонам груди до комфортной глубины.","Выжмите их вверх и слегка внутрь, сохраняя запястья ровными."],"Слишком высокий наклон переносит нагрузку на плечи."),
  exercise("Сведение рук в кроссовере","Грудь","Кроссовер","chest",2,["Поставьте одну ногу вперёд, корпус слегка наклоните.","С мягкими локтями сведите рукояти перед грудью.","Медленно вернитесь до растяжения грудных мышц."],"Не превращайте движение в жим и не раскачивайте корпус."),
  exercise("Отжимания от пола","Грудь","Собственный вес","chest",3,["Ладони чуть шире плеч, тело держите прямой линией.","Опустите грудь между ладонями, сохраняя напряжённый корпус.","Оттолкнитесь от пола до выпрямления рук."],"Не проваливайте поясницу и не тяните голову к полу."),
  exercise("Отжимания на брусьях","Грудь","Брусья","chest",4,["Зафиксируйте плечи вниз и слегка наклоните корпус вперёд.","Согните руки и опуститесь до комфортного растяжения груди.","Выжмите себя вверх, не пожимая плечами."],"Не опускайтесь глубже, чем позволяет подвижность плеч.","Средний"),
  exercise("Разводка гантелей лёжа","Грудь","Гантели · скамья","chest",5,["Держите гантели над грудью, локти немного согнуты.","Разведите руки по дуге до уровня, где плечам комфортно.","Сведите гантели той же дугой, напрягая грудь."],"Не опускайте локти слишком низко и не выпрямляйте их полностью."),

  exercise("Тяга верхнего блока","Спина","Верхний блок","back",0,["Зафиксируйте бёдра, грудь направьте вверх.","Потяните рукоять к верхней части груди, ведя локти вниз.","Плавно распрямите руки, сохраняя контроль лопаток."],"Не тяните рукоять за голову и не отклоняйтесь резко назад."),
  exercise("Тяга штанги в наклоне","Спина","Штанга","back",1,["Отведите таз назад и удерживайте нейтральную спину.","Подтяните гриф к низу живота, локти ведите назад.","Опустите штангу подконтрольно, не меняя наклон корпуса."],"Не округляйте поясницу и не дёргайте вес ногами.","Средний"),
  exercise("Подтягивания","Спина","Турник","back",2,["Повисните, опустите плечи от ушей и напрягите корпус.","Подтяните грудь к перекладине, направляя локти вниз.","Опуститесь до прямых рук без расслабленного падения."],"Не раскачивайтесь и не вытягивайте подбородок вперёд.","Средний"),
  exercise("Горизонтальная тяга блока","Спина","Нижний блок","back",3,["Сядьте ровно, колени слегка согнуты, спина нейтральна.","Потяните рукоять к животу и сведите лопатки.","Верните руки вперёд без сильного округления корпуса."],"Не запрокидывайте корпус назад ради лишнего веса."),
  exercise("Тяга гантели одной рукой","Спина","Гантель · скамья","back",4,["Упритесь рукой и коленом, выровняйте таз и плечи.","Тяните гантель к бедру, локоть ведите вдоль корпуса.","Опустите до растяжения широчайшей без поворота корпуса."],"Не поднимайте плечо к уху и не скручивайте туловище."),
  exercise("Пуловер на верхнем блоке","Спина","Верхний блок","back",5,["Возьмите прямую рукоять и немного наклонитесь вперёд.","На почти прямых руках опустите рукоять к бёдрам.","Медленно вернитесь, сохраняя рёбра собранными."],"Не сгибайте руки как в тяге и не прогибайте поясницу."),

  exercise("Приседания со штангой","Квадрицепс","Штанга · стойка","legs",0,["Поставьте стопы устойчиво, вдохните и напрягите корпус.","Сядьте вниз и назад, колени направляйте по линии носков.","Встаньте, одновременно разгибая колени и таз."],"Не заваливайте колени внутрь и не теряйте нейтральную спину.","Средний"),
  exercise("Жим ногами","Квадрицепс","Тренажёр","legs",1,["Прижмите таз и спину к сиденью, стопы поставьте устойчиво.","Опустите платформу до глубины без подкручивания таза.","Выжмите платформу, не блокируя колени резко."],"Не отрывайте поясницу и не сводите колени."),
  exercise("Румынская тяга","Задняя поверхность бедра","Штанга","legs",2,["Слегка согните колени и отведите таз назад.","Ведите гриф близко к ногам до растяжения задней поверхности бедра.","Сожмите ягодицы и вернитесь в стойку."],"Не приседайте вниз и не округляйте спину.","Средний"),
  exercise("Выпады вперёд","Ягодицы","Собственный вес · гантели","legs",3,["Сделайте достаточно длинный шаг и удерживайте корпус ровно.","Опуститесь, сгибая обе ноги, переднее колено ведите по стопе.","Оттолкнитесь всей передней стопой и вернитесь."],"Не ставьте стопы на одну линию и не падайте на носок."),
  exercise("Разгибание ног","Квадрицепс","Тренажёр","legs",4,["Совместите колено с осью тренажёра, прижмите спину.","Разогните ноги и на секунду напрягите квадрицепс.","Опустите валик медленно, не бросая вес."],"Не используйте рывок и не отрывайте таз от сиденья."),
  exercise("Сгибание ног лёжа","Задняя поверхность бедра","Тренажёр","legs",5,["Расположите валик чуть выше пяток, таз прижмите к скамье.","Согните колени, подтягивая пятки к ягодицам.","Медленно распрямите ноги до растяжения."],"Не поднимайте таз и не прогибайтесь в пояснице."),

  exercise("Жим гантелей сидя","Плечи","Гантели · скамья","arms",0,["Прижмите спину, держите гантели чуть выше плеч.","Выжмите вверх по естественной дуге, не сталкивая гантели.","Опустите до комфортного положения локтей."],"Не переразгибайте поясницу и не опускайте локти слишком низко."),
  exercise("Махи гантелей в стороны","Плечи","Гантели","arms",1,["Встаньте устойчиво, локти слегка согнуты.","Поднимите руки в стороны до уровня плеч, ведя локтями.","Опустите гантели медленно, сохраняя напряжение."],"Не пожимайте плечами и не раскачивайте тяжёлый вес."),
  exercise("Обратная бабочка","Задняя дельта","Тренажёр","arms",2,["Прижмите грудь к опоре и возьмитесь за рукояти.","Разведите руки, направляя локти назад и в стороны.","Вернитесь до лёгкого растяжения без удара плит."],"Не сводите лопатки чрезмерно и не пожимайте плечами."),
  exercise("Сгибание рук со штангой","Бицепс","Штанга","arms",3,["Прижмите локти к бокам и выровняйте запястья.","Согните руки, поднимая гриф без движения плеч вперёд.","Опустите до почти прямых рук под контролем."],"Не раскачивайте корпус и не выводите локти вперёд."),
  exercise("Молотковые сгибания","Бицепс","Гантели","arms",4,["Держите гантели нейтральным хватом, ладони внутрь.","Согните руки, сохраняя локти рядом с корпусом.","Опустите гантели медленно до полного контроля."],"Не помогайте плечами и не бросайте вес вниз."),
  exercise("Разгибание рук на блоке","Трицепс","Верхний блок","arms",5,["Зафиксируйте локти у корпуса и слегка наклонитесь.","Разогните руки вниз до полного напряжения трицепса.","Верните рукоять, двигая только предплечьями."],"Не разводите локти и не наваливайтесь всем весом."),

  exercise("Планка на предплечьях","Кор","Собственный вес","core",0,["Поставьте локти под плечами и вытяните тело в линию.","Подкрутите таз, напрягите пресс и ягодицы.","Дышите спокойно, удерживая одинаковое положение."],"Не проваливайте поясницу и не поднимайте таз слишком высоко."),
  exercise("Скручивания на блоке","Кор","Верхний блок","core",1,["Встаньте на колени и удерживайте канат у головы.","Скрутите рёбра к тазу усилием пресса.","Вернитесь до растяжения, не разгибая таз."],"Не тяните канат руками и не превращайте движение в поклон."),
  exercise("Подъём коленей в висе","Кор","Турник","core",2,["Повисните устойчиво и опустите плечи от ушей.","Подкрутите таз и поднимите колени к груди.","Опустите ноги без раскачивания."],"Не набирайте инерцию и не ограничивайтесь сгибанием бёдер."),
  exercise("Ягодичный мост со штангой","Ягодицы","Штанга · скамья","core",3,["Упритесь лопатками в скамью, гриф положите на сгиб таза.","Поднимите таз до прямой линии плечи–колени.","Сожмите ягодицы и опуститесь подконтрольно."],"Не переразгибайте поясницу в верхней точке.","Средний"),
  exercise("Подъём на носки стоя","Икры","Тренажёр","core",4,["Поставьте подушечки стоп на платформу, корпус держите ровно.","Поднимитесь максимально высоко на носки.","Опустите пятки до мягкого растяжения икр."],"Не пружиньте и не заворачивайте стопы внутрь."),
  exercise("Подъём на носки сидя","Икры","Тренажёр","core",5,["Зафиксируйте колени под подушками, стопы на платформе.","Поднимите пятки, сокращая камбаловидные мышцы.","Опустите пятки медленно до растяжения."],"Не делайте короткие быстрые повторения без полной амплитуды."),

  popularExercise("Жим в тренажёре сидя","Грудь","Тренажёр","chest",0,"Отрегулируйте сиденье так, чтобы рукояти были на уровне середины груди.","Выжмите рукояти вперёд, сохраняя лопатки прижатыми к спинке.","Не отрывайте плечи и не блокируйте локти резко."),
  popularExercise("Жим штанги на наклонной скамье","Грудь","Штанга · наклонная скамья","chest",1,"Установите наклон 20–35°, сведите лопатки и устойчиво поставьте стопы.","Опустите гриф к верхней части груди и выжмите по той же траектории.","Не ставьте скамью слишком вертикально и не разводите локти.","Средний"),
  popularExercise("Жим штанги на наклонной вниз","Грудь","Штанга · скамья","chest",0,"Зафиксируйте ноги, сведите лопатки и снимите штангу над нижней частью груди.","Опустите гриф подконтрольно и выжмите вверх без отрыва таза.","Используйте страховку и не опускайте гриф к шее.","Средний"),
  popularExercise("Жим гантелей на наклонной вниз","Грудь","Гантели · скамья","chest",1,"Надёжно зафиксируйте ноги и расположите гантели по сторонам груди.","Выжмите гантели вверх и немного внутрь, сохраняя ровные запястья.","Не бросайте гантели и не используйте чрезмерную глубину.","Средний"),
  popularExercise("Жим в Смите лёжа","Грудь","Машина Смита · скамья","chest",0,"Поставьте скамью так, чтобы гриф опускался к середине груди.","Снимите фиксаторы, опустите гриф и выжмите вертикально вверх.","Не располагайте скамью слишком далеко от линии грифа."),
  popularExercise("Пуловер с гантелью","Грудь","Гантель · скамья","chest",5,"Лягте на скамью и удерживайте одну гантель над грудью слегка согнутыми руками.","Опустите гантель за голову до растяжения и верните над грудью.","Не прогибайте поясницу и не меняйте угол локтей."),
  popularExercise("Сведение рук в тренажёре","Грудь","Тренажёр бабочка","chest",2,"Отрегулируйте сиденье, прижмите спину и разместите предплечья на опорах.","Сведите локти перед грудью и задержитесь на секунду.","Не выводите плечи вперёд и не ударяйте весовым стеком."),
  popularExercise("Отжимания с колен","Грудь","Собственный вес","chest",3,"Поставьте ладони чуть шире плеч и выстройте линию от коленей до головы.","Опустите грудь между ладонями и оттолкнитесь вверх.","Не сгибайтесь в тазу и не вытягивайте шею."),

  popularExercise("Классическая становая тяга","Всё тело","Штанга","legs",2,"Поставьте стопы под гриф, возьмитесь снаружи коленей и напрягите корпус.","Оттолкните пол ногами и выпрямитесь, ведя гриф близко к телу.","Не округляйте спину и не отклоняйтесь назад вверху.","Средний"),
  popularExercise("Тяга Т-грифа","Спина","Т-гриф","back",1,"Упритесь стопами, наклонитесь с нейтральной спиной и возьмите рукояти.","Тяните рукоять к низу груди, направляя локти назад.","Не выпрямляйте корпус рывком и не округляйте поясницу.","Средний"),
  popularExercise("Тяга с упором грудью","Спина","Гантели · наклонная скамья","back",4,"Лягте грудью на наклонную скамью, руки с гантелями опустите вниз.","Подтяните гантели к рёбрам и сведите лопатки.","Не отрывайте грудь от опоры и не пожимайте плечами."),
  popularExercise("Тяга Хаммер","Спина","Рычажный тренажёр","back",3,"Прижмите грудь к опоре и возьмитесь за рукояти нейтральным хватом.","Потяните локти назад до сведения лопаток.","Не запрокидывайте голову и не отрывайтесь от упора."),
  popularExercise("Тяга верхнего блока нейтральным хватом","Спина","Верхний блок","back",0,"Зафиксируйте бёдра и возьмите параллельную рукоять.","Потяните рукоять к верхней части груди, направляя локти вниз.","Не раскачивайте корпус и не тяните только бицепсами."),
  popularExercise("Тяга верхнего блока обратным хватом","Спина","Верхний блок","back",0,"Возьмите гриф снизу на ширине плеч и слегка отклоните корпус.","Потяните гриф к груди, удерживая локти близко к телу.","Не заламывайте запястья и не отклоняйтесь слишком далеко."),
  popularExercise("Австралийские подтягивания","Спина","Низкая перекладина","back",2,"Повисните под низкой перекладиной, тело держите прямой линией.","Подтяните грудь к перекладине, сводя лопатки.","Не проваливайте таз и не тянитесь подбородком."),
  popularExercise("Шраги с гантелями","Трапеции","Гантели","arms",1,"Встаньте ровно с гантелями по сторонам и опустите плечи.","Поднимите плечи строго вверх к ушам без вращения.","Не делайте круговые движения и не сгибайте локти."),

  popularExercise("Фронтальные приседания","Квадрицепс","Штанга · стойка","legs",0,"Положите гриф на передние дельты, поднимите локти и напрягите корпус.","Сядьте между стопами, сохраняя грудь поднятой, затем встаньте.","Не опускайте локти и не заваливайте колени внутрь.","Средний"),
  popularExercise("Гоблет-присед","Квадрицепс","Гантель · гиря","legs",0,"Держите вес у груди и поставьте стопы чуть шире плеч.","Присядьте между бёдрами, направляя колени по линии носков.","Не отрывайте пятки и не округляйте поясницу."),
  popularExercise("Гакк-присед","Квадрицепс","Гакк-тренажёр","legs",1,"Прижмите спину к платформе и поставьте стопы устойчиво.","Опуститесь до комфортной глубины и выжмите платформу всей стопой.","Не блокируйте колени и не отрывайте таз от спинки."),
  popularExercise("Приседания в Смите","Квадрицепс","Машина Смита","legs",0,"Разместите гриф на трапециях, стопы поставьте немного впереди грифа.","Опуститесь подконтрольно и встаньте через середину стопы.","Не ставьте стопы слишком близко и не сводите колени."),
  popularExercise("Болгарские выпады","Ягодицы","Гантели · скамья","legs",3,"Поставьте заднюю стопу на скамью, переднюю — достаточно далеко.","Опустите таз вниз и выжмите себя передней ногой.","Не ставьте переднюю стопу слишком близко к скамье.","Средний"),
  popularExercise("Зашагивания на тумбу","Ягодицы","Тумба · гантели","legs",3,"Поставьте всю рабочую стопу на устойчивую тумбу.","Поднимитесь за счёт передней ноги и полностью выпрямите таз.","Не отталкивайтесь сильно задней ногой и не падайте вниз."),
  popularExercise("Становая тяга сумо","Ягодицы","Штанга","legs",2,"Поставьте стопы широко, носки наружу, возьмите гриф между ног.","Разведите колени и встаньте, ведя гриф близко к телу.","Не поднимайте таз раньше плеч и не округляйте спину.","Средний"),
  popularExercise("Наклоны со штангой good morning","Задняя поверхность бедра","Штанга","legs",2,"Положите лёгкую штангу на трапеции, слегка согните колени.","Отведите таз назад и наклонитесь с нейтральной спиной.","Не используйте тяжёлый вес и не превращайте движение в присед.","Средний"),
  popularExercise("Отведение ног в тренажёре","Ягодицы","Тренажёр","legs",3,"Сядьте ровно, прижмите колени к внешним подушкам.","Разведите колени усилием ягодичных мышц и сделайте паузу.","Не раскачивайтесь и не бросайте вес обратно."),
  popularExercise("Приведение ног в тренажёре","Внутренняя поверхность бедра","Тренажёр","legs",4,"Сядьте устойчиво и разведите платформы до комфортного положения.","Сведите колени плавно, напрягая внутреннюю поверхность бёдер.","Не выбирайте болезненную амплитуду и не ударяйте плитами."),
  popularExercise("Отведение ноги назад в кроссовере","Ягодицы","Нижний блок · манжета","legs",3,"Закрепите манжету на щиколотке и удерживайтесь за стойку.","Отведите прямую ногу назад усилием ягодицы без наклона корпуса.","Не прогибайте поясницу и не разворачивайте таз."),
  popularExercise("Ягодичный мост на полу","Ягодицы","Собственный вес","core",3,"Лягте, согните колени и поставьте стопы на ширине таза.","Поднимите таз, сожмите ягодицы и сохраните рёбра собранными.","Не толкайтесь носками и не переразгибайте поясницу."),

  popularExercise("Жим штанги стоя","Плечи","Штанга","arms",0,"Поставьте стопы устойчиво, держите гриф у верхней части груди.","Выжмите гриф над головой и мягко выведите голову вперёд.","Не отклоняйтесь назад и не используйте ноги без необходимости.","Средний"),
  popularExercise("Жим Арнольда","Плечи","Гантели · скамья","arms",0,"Начните с гантелями перед лицом, ладони направлены к себе.","Разворачивайте предплечья и выжимайте гантели над головой.","Не форсируйте вращение и не прогибайте поясницу."),
  popularExercise("Тяга штанги к подбородку","Плечи","Штанга","arms",1,"Возьмите гриф хватом немного шире плеч и держите близко к телу.","Поднимите локти до уровня плеч, не задирая их выше.","Не используйте узкий хват при дискомфорте в плечах.","Средний"),
  popularExercise("Подъём гантелей перед собой","Передняя дельта","Гантели","arms",1,"Встаньте ровно, держите гантели перед бёдрами.","Поднимите одну или две руки до уровня плеч.","Не раскачивайтесь и не поднимайте вес выше головы."),
  popularExercise("Махи в стороны на блоке","Плечи","Нижний блок","arms",1,"Встаньте боком к блоку и возьмите дальнюю рукоять.","Поднимите руку в сторону до уровня плеч, ведя локтем.","Не пожимайте плечом и не поворачивайте корпус."),
  popularExercise("Тяга каната к лицу","Задняя дельта","Верхний блок · канат","arms",2,"Установите канат на уровне лица и отойдите до натяжения.","Потяните канат к вискам, разводя кисти и локти.","Не прогибайтесь и не опускайте локти слишком низко."),
  popularExercise("Разводка гантелей в наклоне","Задняя дельта","Гантели","arms",2,"Наклонитесь с нейтральной спиной, руки опустите вниз.","Разведите гантели в стороны, ведя движение локтями.","Не поднимайте корпус и не сводите лопатки чрезмерно."),

  popularExercise("Сгибание рук на скамье Скотта","Бицепс","EZ-гриф · скамья Скотта","arms",3,"Разместите плечи на подушке и выровняйте запястья.","Согните руки без отрыва локтей от опоры.","Не распрямляйте локти резко под тяжёлым весом."),
  popularExercise("Сгибание гантелей на наклонной","Бицепс","Гантели · наклонная скамья","arms",4,"Прижмите спину к скамье и опустите руки вертикально.","Согните локти, не выводя плечи вперёд.","Не раскачивайте гантели и не сокращайте амплитуду."),
  popularExercise("Сгибание рук на нижнем блоке","Бицепс","Нижний блок","arms",3,"Встаньте близко к блоку и прижмите локти к бокам.","Подтяните рукоять к плечам, сохраняя корпус неподвижным.","Не отклоняйтесь назад и не двигайте локтями."),
  popularExercise("Концентрированное сгибание","Бицепс","Гантель · скамья","arms",4,"Сядьте и уприте локоть во внутреннюю часть бедра.","Поднимите гантель к плечу и сожмите бицепс.","Не помогайте корпусом и не бросайте вес."),
  popularExercise("Жим лёжа узким хватом","Трицепс","Штанга · скамья","chest",0,"Сведите лопатки и возьмите гриф немного уже ширины плеч.","Опустите гриф к нижней части груди, ведя локти вдоль корпуса.","Не используйте чрезмерно узкий хват и не разводите локти.","Средний"),
  popularExercise("Французский жим лёжа","Трицепс","EZ-гриф · скамья","arms",5,"Держите гриф над плечами и зафиксируйте плечевые кости.","Согните локти, опуская гриф ко лбу или немного за голову.","Не разводите локти и не двигайте плечами."),
  popularExercise("Разгибание гантели из-за головы","Трицепс","Гантель","arms",5,"Держите гантель над головой двумя руками, локти направьте вперёд.","Согните руки за головой и разогните до верхней точки.","Не разводите локти и не прогибайте поясницу."),
  popularExercise("Разгибание рук с канатом","Трицепс","Верхний блок · канат","arms",5,"Зафиксируйте локти у корпуса и возьмите концы каната.","Разогните руки вниз и разведите концы каната у бёдер.","Не двигайте плечами и не наваливайтесь на рукоять."),
  popularExercise("Обратные отжимания от скамьи","Трицепс","Скамья · собственный вес","chest",4,"Поставьте ладони на край скамьи, таз держите рядом с опорой.","Согните локти назад и выжмите себя вверх.","Не уходите слишком далеко от скамьи и не опускайтесь чрезмерно глубоко."),

  popularExercise("Скручивания на полу","Кор","Собственный вес","core",1,"Лягте, согните колени и мягко поддерживайте голову.","Подкрутите рёбра к тазу, приподняв лопатки.","Не тяните шею руками и не садитесь полностью."),
  popularExercise("Велосипед","Кор","Собственный вес","core",2,"Лягте, прижмите поясницу и поднимите согнутые ноги.","Поочерёдно тяните плечо к противоположному колену.","Не ускоряйтесь за счёт рывков и не отрывайте поясницу."),
  popularExercise("Русские повороты","Кор","Собственный вес · диск","core",1,"Сядьте, слегка отклонитесь назад и напрягите пресс.","Поворачивайте грудную клетку из стороны в сторону.","Не двигайте только руками и не округляйте поясницу."),
  popularExercise("Мёртвый жук","Кор","Собственный вес","core",0,"Лягте, поднимите руки и ноги, прижмите поясницу к полу.","Одновременно опустите противоположные руку и ногу, не теряя положение таза.","Не позволяйте пояснице отрываться от пола."),
  popularExercise("Боковая планка","Косые мышцы","Собственный вес","core",0,"Поставьте локоть под плечом и выстройте тело боковой линией.","Поднимите таз и удерживайте корпус без вращения.","Не проваливайте плечо и не отводите таз назад."),
  popularExercise("Ролик для пресса","Кор","Ролик","core",0,"Встаньте на колени, возьмите ролик и подкрутите таз.","Прокатите ролик вперёд до контролируемой глубины и вернитесь прессом.","Не проваливайте поясницу и не начинайте с полной амплитуды.","Средний"),
];

const defaultTemplates: Template[] = [
  { id: 1, name: "Верх тела", subtitle: "Грудь · Спина · Плечи", exercises: [
    { id: 1, name: "Жим штанги лёжа", muscle: "Грудь", restSeconds: 120, sets: setRows([[60,10],[65,8],[65,8]]) },
    { id: 2, name: "Тяга верхнего блока", muscle: "Спина", restSeconds: 90, sets: setRows([[55,12],[60,10],[60,10]]) },
    { id: 3, name: "Жим гантелей сидя", muscle: "Плечи", restSeconds: 90, sets: setRows([[18,10],[18,10],[18,8]]) },
  ]},
  { id: 2, name: "Ноги", subtitle: "Квадрицепс · Бицепс бедра · Ягодицы", exercises: [
    { id: 4, name: "Приседания со штангой", muscle: "Ноги", restSeconds: 180, sets: setRows([[70,10],[80,8],[80,8]]) },
    { id: 5, name: "Жим ногами", muscle: "Ноги", restSeconds: 120, sets: setRows([[120,12],[130,10],[130,10]]) },
    { id: 6, name: "Сгибание ног", muscle: "Ноги", restSeconds: 75, sets: setRows([[35,12],[40,10],[40,10]]) },
  ]},
  { id: 3, name: "Руки и плечи", subtitle: "Плечи · Бицепс · Трицепс", exercises: [
    { id: 7, name: "Махи гантелей в стороны", muscle: "Плечи", restSeconds: 60, sets: setRows([[8,15],[8,15],[8,12]]) },
    { id: 8, name: "Сгибание рук со штангой", muscle: "Бицепс", restSeconds: 75, sets: setRows([[25,12],[30,10],[30,8]]) },
    { id: 9, name: "Разгибание рук на блоке", muscle: "Трицепс", restSeconds: 75, sets: setRows([[25,12],[30,10],[30,10]]) },
  ]},
];

const seedHistory: Session[] = [
  { id: 1, iso: "2026-07-22", date: "22 июл", title: "Верх тела", volume: 4280, duration: 54, exercises: [
    { name: "Жим штанги лёжа", muscle: "Грудь", sets: [{weight:60,reps:10},{weight:65,reps:8},{weight:65,reps:8}] },
    { name: "Тяга верхнего блока", muscle: "Спина", sets: [{weight:55,reps:12},{weight:60,reps:10},{weight:60,reps:10}] },
  ]},
  { id: 2, iso: "2026-07-19", date: "19 июл", title: "Ноги", volume: 6120, duration: 61, exercises: [
    { name: "Приседания со штангой", muscle: "Ноги", sets: [{weight:70,reps:10},{weight:80,reps:8},{weight:80,reps:8}] },
  ]},
  { id: 3, iso: "2026-07-16", date: "16 июл", title: "Верх тела", volume: 3860, duration: 49 },
];

const initialState: SavedState = { templates: defaultTemplates, activeTemplateId: 1, history: seedHistory, measurements: [] };

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></>,
    dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, check: <path d="m5 12 4 4L19 7"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

const ExerciseImage = ({ item, large = false }: { item: CatalogExercise; large?: boolean }) => {
  const col = item.slot % 3;
  const row = Math.floor(item.slot / 3);
  return <div
    className={`exercise-image ${large ? "large" : ""}`}
    role="img"
    aria-label={`Техника: ${item.name}`}
    style={{
      backgroundImage: `url("${basePath}/exercises/${item.sheet}.jpg")`,
      backgroundPosition: `${col * 50}% ${row * 100}%`,
    }}
  />;
};

function openDb() {
  return new Promise<IDBDatabase | null>(resolve => {
    if (!("indexedDB" in window)) return resolve(null);
    const req = indexedDB.open("irontrack", 2);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("state")) req.result.createObjectStore("state"); };
    req.onerror = () => resolve(null); req.onsuccess = () => resolve(req.result);
  });
}

export default function Home() {
  const [tab, setTab] = useState<"home"|"workout"|"progress"|"history">("home");
  const [state, setState] = useState<SavedState>(initialState);
  const [exercises, setExercises] = useState<Exercise[]>(cloneExercises(defaultTemplates[0].exercises));
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [rest, setRest] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<CatalogExercise | null>(null);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Загружаю данные…");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Все");
  const [reportPeriod, setReportPeriod] = useState<"week"|"month">("month");
  const [measureForm, setMeasureForm] = useState({ weight:"", waist:"", chest:"", arm:"", photo:"" });

  const activeTemplate = state.templates.find(t => t.id === state.activeTemplateId) || state.templates[0];

  useEffect(() => {
    (async () => {
      let value: SavedState | null = null;
      const db = await openDb();
      if (db) value = await new Promise(resolve => {
        const req = db.transaction("state","readonly").objectStore("state").get("latest");
        req.onsuccess = () => resolve(req.result || null); req.onerror = () => resolve(null);
      });
      if (!value) {
        try {
          const raw = localStorage.getItem("irontrack-v4") || localStorage.getItem("irontrack-state");
          if (raw) {
            const old = JSON.parse(raw);
            value = old.templates ? old : { ...initialState, history: old.history || seedHistory };
          }
        } catch {}
      }
      if (value && !value.templates) {
        const legacy = value as unknown as { history?: Session[] };
        value = { ...initialState, history: legacy.history || seedHistory };
      }
      if (value) {
        const history = (value.history || seedHistory).map((session, index) => {
          const fallback = new Date();
          fallback.setDate(fallback.getDate() - index * 3);
          const iso = session.iso || fallback.toISOString().slice(0, 10);
          return { ...session, id: session.id || Date.now() + index, iso, date: session.date || formatDate(iso) };
        });
        value = {
          ...value,
          history,
          measurements: value.measurements || [],
          activeTemplateId: value.activeTemplateId || value.templates[0].id,
        };
      }
      const next = value || initialState;
      setState(next);
      const template = next.templates.find(t => t.id === next.activeTemplateId) || next.templates[0];
      let restored = false;
      try {
        const active = JSON.parse(localStorage.getItem("irontrack-active-workout") || "null") as ActiveWorkout | null;
        if (active?.exercises?.length) {
          setState(s=>({...s,activeTemplateId:active.templateId}));
          setExercises(active.exercises); setSeconds(active.seconds || 0); setRest(active.rest || 0); setStarted(true); setTab("workout"); restored = true;
        }
      } catch {}
      if (!restored) setExercises(cloneExercises(template.exercises));
      if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {});
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      setLoaded(true); setSaveStatus("Сохранено на устройстве");
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("Сохраняю…");
    const id = window.setTimeout(async () => {
      const db = await openDb();
      if (db) db.transaction("state","readwrite").objectStore("state").put(state, "latest");
      try {
        const light = { ...state, measurements: state.measurements.map(m => ({...m, photo: undefined})) };
        localStorage.setItem("irontrack-v4", JSON.stringify(light));
      } catch {}
      setSaveStatus("Сохранено на устройстве");
    }, 350);
    return () => clearTimeout(id);
  }, [state, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (!started) {
      localStorage.removeItem("irontrack-active-workout");
      return;
    }
    const active:ActiveWorkout = {templateId:state.activeTemplateId,exercises,seconds,rest};
    localStorage.setItem("irontrack-active-workout",JSON.stringify(active));
  }, [started,exercises,seconds,rest,state.activeTemplateId,loaded]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => setSeconds(v => v + 1), 1000);
    return () => clearInterval(timer);
  }, [started]);

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setInterval(() => setRest(v => {
      if (v === 1) {
        try {
          navigator.vibrate?.([200,100,200]);
          const AudioCtx = window.AudioContext || (window as typeof window & {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
          const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 740; gain.gain.value = .08; osc.start(); osc.stop(ctx.currentTime + .25);
        } catch {}
      }
      return Math.max(0, v - 1);
    }), 1000);
    return () => clearInterval(timer);
  }, [rest]);

  const allSets = exercises.flatMap(e => e.sets);
  const doneSets = allSets.filter(s => s.done).length;
  const liveVolume = allSets.filter(s => s.done).reduce((n,s) => n + s.weight*s.reps, 0);
  const fmt = (v:number) => `${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`;
  const currentMonth = todayIso().slice(0,7);
  const monthSessions = state.history.filter(h=>h.iso.slice(0,7)===currentMonth);
  const monthVolume = monthSessions.reduce((s,h) => s+h.volume,0);
  const allTimeVolume = state.history.reduce((s,h) => s+h.volume,0);
  const chart = useMemo(() => [...state.history].slice(0,6).reverse().map(s => s.volume), [state.history]);
  const previousByName = (name:string) => state.history.find(h => h.exercises?.some(e => e.name === name))?.exercises?.find(e => e.name === name);
  const weekStats = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sessions = state.history.filter(h => new Date(`${h.iso}T12:00:00`) >= monday);
    return {
      count: sessions.length,
      volume: sessions.reduce((sum, session) => sum + session.volume, 0),
      trainedToday: sessions.some(session => session.iso === todayIso()),
    };
  }, [state.history]);

  const records = useMemo(() => {
    const map = new Map<string,{weight:number; oneRm:number}>();
    state.history.flatMap(h => h.exercises || []).forEach(e => e.sets.forEach(s => {
      const oneRm = Math.round(s.weight * (1 + s.reps/30) * 10)/10;
      const prev = map.get(e.name);
      if (!prev || oneRm > prev.oneRm) map.set(e.name,{weight:s.weight,oneRm});
    }));
    return [...map.entries()].sort((a,b) => b[1].oneRm-a[1].oneRm);
  }, [state.history]);

  const reportSessions = useMemo(() => {
    const days = reportPeriod === "week" ? 7 : 31;
    const threshold = new Date(); threshold.setDate(threshold.getDate()-days);
    return state.history.filter(h => new Date(`${h.iso}T12:00:00`) >= threshold);
  }, [state.history, reportPeriod]);

  function chooseTemplate(id:number) {
    const template = state.templates.find(t => t.id===id); if (!template) return;
    setState(s => ({...s,activeTemplateId:id})); setExercises(cloneExercises(template.exercises)); setProgramsOpen(false);
  }
  function createProgram() {
    const name = prompt("Название тренировочного дня"); if (!name?.trim()) return;
    const template:Template = {id:Date.now(),name:name.trim(),subtitle:"Своя программа",exercises:[]};
    setState(s => ({...s,templates:[...s.templates,template],activeTemplateId:template.id}));
    setExercises([]); setProgramsOpen(false);
  }
  function deleteProgram(id:number) {
    if (state.templates.length<=1 || !confirm("Удалить эту программу?")) return;
    const templates=state.templates.filter(t=>t.id!==id); setState(s=>({...s,templates,activeTemplateId:templates[0].id}));
    setExercises(cloneExercises(templates[0].exercises));
  }
  function updateSet(exerciseId:number,setId:number,key:"weight"|"reps",value:number) {
    setExercises(items=>items.map(e=>e.id===exerciseId?{...e,sets:e.sets.map(s=>s.id===setId?{...s,[key]:value}:s)}:e));
  }
  function syncTemplate(next:Exercise[]) {
    setExercises(next); setState(s=>({...s,templates:s.templates.map(t=>t.id===s.activeTemplateId?{...t,exercises:next.map(e=>({...e,sets:e.sets.map(x=>({...x,done:false}))}))}:t)}));
  }
  function toggleSet(exerciseId:number,setId:number) {
    const ex=exercises.find(e=>e.id===exerciseId);
    const row=ex?.sets.find(s=>s.id===setId);
    setExercises(items=>items.map(e=>e.id===exerciseId?{...e,sets:e.sets.map(s=>s.id===setId?{...s,done:!s.done}:s)}:e));
    if (!row?.done) setRest(ex?.restSeconds || 90);
  }
  function removeSet(exerciseId:number,setId:number) {
    setExercises(items=>items.map(e=>e.id===exerciseId?{...e,sets:e.sets.filter(s=>s.id!==setId)}:e));
  }
  function removeExercise(exerciseId:number) {
    setExercises(items=>items.filter(e=>e.id!==exerciseId));
  }
  function moveExercise(index:number,direction:-1|1) {
    setExercises(items=>{const next=[...items],target=index+direction;if(target<0||target>=next.length)return items;[next[index],next[target]]=[next[target],next[index]];return next;});
  }
  function fillPrevious(exerciseId:number,name:string) {
    const previous=previousByName(name); if(!previous)return;
    setExercises(items=>items.map(e=>e.id===exerciseId?{...e,sets:previous.sets.map((s,i)=>({id:Date.now()+i,weight:s.weight,reps:s.reps,done:false}))}:e));
  }
  function recommendation(name:string) {
    const previous=previousByName(name); if(!previous?.sets.length)return null;
    const best=[...previous.sets].sort((a,b)=>b.weight-a.weight||b.reps-a.reps)[0];
    return best.reps>=10?`${Math.round((best.weight+2.5)*10)/10} × ${Math.max(6,best.reps-2)}`:`${best.weight} × ${best.reps+1}`;
  }
  function addCatalogExercise(name:string,muscle:string) {
    const next=[...exercises,{id:Date.now(),name,muscle,restSeconds:90,sets:setRows([[20,10],[20,10],[20,10]])}];
    syncTemplate(next); setCatalogOpen(false); setCatalogSearch("");
  }
  function customExercise() {
    const name=prompt("Название упражнения"); if(!name?.trim())return;
    const muscle=prompt("Группа мышц","Другое")||"Другое"; addCatalogExercise(name.trim(),muscle);
  }
  function finishWorkout() {
    if(!doneSets)return;
    const completed:CompletedExercise[]=exercises.map(e=>({name:e.name,muscle:e.muscle,sets:e.sets.filter(s=>s.done).map(s=>({weight:s.weight,reps:s.reps}))})).filter(e=>e.sets.length);
    const session:Session={id:Date.now(),iso:todayIso(),date:formatDate(todayIso()),title:activeTemplate.name,volume:liveVolume,duration:Math.max(1,Math.round(seconds/60)),exercises:completed};
    setState(s=>({...s,history:[session,...s.history]})); setExercises(cloneExercises(activeTemplate.exercises));
    setStarted(false);setSeconds(0);setRest(0);setTab("home");
  }
  function editSessionDate(session:Session) {
    const iso=prompt("Дата тренировки (ГГГГ-ММ-ДД)",session.iso); if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return;
    setState(s=>({...s,history:s.history.map(h=>h.id===session.id?{...h,iso,date:formatDate(iso)}:h)}));
  }
  function deleteSession(id:number) {
    if(confirm("Удалить эту тренировку из истории?"))setState(s=>({...s,history:s.history.filter(h=>h.id!==id)}));
  }
  function addMeasurement() {
    const item:Measurement={id:Date.now(),iso:todayIso(),weight:Number(measureForm.weight)||0,waist:Number(measureForm.waist)||0,chest:Number(measureForm.chest)||0,arm:Number(measureForm.arm)||0,photo:measureForm.photo||undefined};
    setState(s=>({...s,measurements:[item,...s.measurements]}));setMeasureForm({weight:"",waist:"",chest:"",arm:"",photo:""});setMeasurementOpen(false);
  }
  function loadPhoto(file?:File) {
    if(!file)return; const reader=new FileReader();
    reader.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,900/img.width);const canvas=document.createElement("canvas");canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext("2d")?.drawImage(img,0,0,canvas.width,canvas.height);setMeasureForm(f=>({...f,photo:canvas.toDataURL("image/jpeg",.72)}));};img.src=String(reader.result);};reader.readAsDataURL(file);
  }
  function exportCsv() {
    const rows=[["Дата","Тренировка","Минуты","Объём, кг"],...reportSessions.map(s=>[s.iso,s.title,String(s.duration),String(s.volume)])];
    const blob=new Blob(["\ufeff"+rows.map(r=>r.map(x=>`"${x.replaceAll('"','""')}"`).join(";")).join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`irontrack-${reportPeriod}.csv`;a.click();URL.revokeObjectURL(url);
  }
  function exportBackup() {
    const blob=new Blob([JSON.stringify({...state,version:4,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`irontrack-backup-${todayIso()}.json`;a.click();URL.revokeObjectURL(url);
  }
  function importBackup(file?:File) {
    if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const v=JSON.parse(String(reader.result));if(!v.templates||!v.history)throw Error();const template=v.templates.find((t:Template)=>t.id===v.activeTemplateId)||v.templates[0];setState(v);setExercises(cloneExercises(template.exercises));setSettings(false);}catch{alert("Не удалось прочитать копию IronTrack.");}};reader.readAsText(file);
  }

  const muscles=["Все",...Array.from(new Set(catalog.map(x=>x.muscle)))];
  const filteredCatalog=catalog.filter(x=>(muscleFilter==="Все"||x.muscle===muscleFilter)&&`${x.name} ${x.muscle} ${x.equipment}`.toLowerCase().includes(catalogSearch.toLowerCase()));
  const calendarDays=useMemo(()=>{const now=new Date();const y=now.getFullYear(),m=now.getMonth();const first=(new Date(y,m,1).getDay()+6)%7;const count=new Date(y,m+1,0).getDate();return [...Array(first).fill(null),...Array.from({length:count},(_,i)=>i+1)];},[]);
  const trainedDays=new Set(state.history.filter(h=>h.iso.slice(0,7)===todayIso().slice(0,7)).map(h=>Number(h.iso.slice(8,10))));

  return <main className="shell">
    <header><button className="brand" onClick={()=>setTab("home")} aria-label="На главную"><span>IR</span><b>IronTrack<small>TRAIN SMART</small></b></button><button className="avatar" onClick={()=>setSettings(true)} aria-label="Настройки и данные">⚙</button></header>

    {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="Настройки и данные" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setSettings(false)} aria-label="Закрыть">×</button><div className="eyebrow">ДАННЫЕ И ПРИЛОЖЕНИЕ</div><h2>Всё под контролем.</h2>
      <div className="save-state cloud"><i/><div><strong>{saveStatus}</strong><span>Локальная база и офлайн-режим активны</span></div></div>
      <button className="data-button" onClick={exportBackup}><span>↓</span><div><strong>Скачать копию</strong><small>Программы, история, замеры и фото</small></div></button>
      <label className="data-button"><span>↑</span><div><strong>Восстановить данные</strong><small>Загрузить резервную копию</small></div><input type="file" accept=".json" onChange={e=>importBackup(e.target.files?.[0])}/></label>
      <p className="privacy-note">Данные хранятся на этом устройстве. Не очищайте данные сайта без резервной копии.</p>
    </section></div>}

    {programsOpen&&<div className="modal-backdrop" onClick={()=>setProgramsOpen(false)}><section className="settings-modal tall-modal" role="dialog" aria-modal="true" aria-label="Мои программы" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setProgramsOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow">ПРОГРАММА</div><h2>Тренировочные дни</h2>
      <div className="program-list">{state.templates.map(t=><div className={t.id===state.activeTemplateId?"selected":""} key={t.id}><button onClick={()=>chooseTemplate(t.id)}><strong>{t.name}</strong><small>{t.exercises.length} упражнений · {t.subtitle}</small></button><button className="trash" onClick={()=>deleteProgram(t.id)}>×</button></div>)}</div>
      <button className="primary light-primary" onClick={createProgram}>+ Создать программу</button>
    </section></div>}

    {catalogOpen&&<div className="modal-backdrop" onClick={()=>{setCatalogOpen(false);setSelectedExercise(null)}}><section className="settings-modal tall-modal catalog-modal" role="dialog" aria-modal="true" aria-label="Каталог упражнений" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>{setCatalogOpen(false);setSelectedExercise(null)}} aria-label="Закрыть">×</button>
      {selectedExercise?<div className="exercise-detail">
        <button className="detail-back" onClick={()=>setSelectedExercise(null)}>← Все упражнения</button>
        <ExerciseImage item={selectedExercise} large/>
        <div className="detail-heading"><div><span>{selectedExercise.muscle}</span><h2>{selectedExercise.name}</h2></div><small>{selectedExercise.level}</small></div>
        <div className="equipment">Инвентарь: <strong>{selectedExercise.equipment}</strong></div>
        <h3>Как выполнять</h3>
        <ol>{selectedExercise.steps.map(step=><li key={step}>{step}</li>)}</ol>
        <div className="mistake"><strong>Обратите внимание</strong><span>{selectedExercise.mistakes}</span></div>
        <button className="primary light-primary" onClick={()=>addCatalogExercise(selectedExercise.name,selectedExercise.muscle)}>+ Добавить в тренировку</button>
      </div>:<>
        <div className="eyebrow">КАТАЛОГ · {catalog.length} УПРАЖНЕНИЙ</div><h2>Выберите упражнение</h2>
        <input className="search-input" placeholder="Название, мышца или инвентарь" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}/>
        <div className="filter-row">{muscles.map(m=><button className={m===muscleFilter?"active":""} key={m} onClick={()=>setMuscleFilter(m)}>{m}</button>)}</div>
        <div className="catalog-list">{filteredCatalog.map(item=><article className="catalog-card" key={item.name}>
          <button className="catalog-info" onClick={()=>setSelectedExercise(item)}><ExerciseImage item={item}/><span><strong>{item.name}</strong><small>{item.muscle} · {item.equipment}</small><em>Техника и описание →</em></span></button>
          <button className="catalog-add" aria-label={`Добавить ${item.name}`} onClick={()=>addCatalogExercise(item.name,item.muscle)}>+</button>
        </article>)}</div>
        <button className="add-set custom-button" onClick={customExercise}>+ Создать своё упражнение</button>
      </>}
    </section></div>}

    {measurementOpen&&<div className="modal-backdrop" onClick={()=>setMeasurementOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="Новый замер" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setMeasurementOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow">ПРОГРЕСС ТЕЛА</div><h2>Новый замер</h2>
      <div className="measure-grid">{[["weight","Вес, кг"],["waist","Талия, см"],["chest","Грудь, см"],["arm","Рука, см"]].map(([k,l])=><label key={k}><span>{l}</span><input type="number" value={measureForm[k as keyof typeof measureForm]} onChange={e=>setMeasureForm(f=>({...f,[k]:e.target.value}))}/></label>)}</div>
      <label className="photo-picker">{measureForm.photo?<img src={measureForm.photo} alt="Фото прогресса"/>:<span>＋ Добавить фото прогресса</span>}<input type="file" accept="image/*" onChange={e=>loadPhoto(e.target.files?.[0])}/></label>
      <button className="finish" onClick={addMeasurement}>Сохранить замер</button>
    </section></div>}

    {tab==="home"&&<section className="screen home-screen">
      <div className="eyebrow">СЕГОДНЯ · {formatDate(todayIso()).toUpperCase()}</div>
      <article className="week-widget">
        <div className="week-ring" style={{"--week-progress":`${Math.min(100,weekStats.count/3*100)}%`} as React.CSSProperties}><strong>{weekStats.count}</strong><span>/ 3</span></div>
        <div className="week-copy"><small>ЦЕЛЬ НА НЕДЕЛЮ</small><h2>{weekStats.trainedToday?"Тренировка записана":"Ваш темп"}</h2><p>{weekStats.count>=3?"Цель выполнена — отличная неделя.":`Осталось ${3-weekStats.count} ${3-weekStats.count===1?"тренировка":"тренировки"} до цели.`}</p></div>
        <button onClick={()=>setTab("history")}><strong>{(weekStats.volume/1000).toFixed(1)} т</strong><span>объём ↗</span></button>
      </article>
      <div className="program-picker"><button onClick={()=>setProgramsOpen(true)}><span><small>ТЕКУЩАЯ ПРОГРАММА</small><strong>{activeTemplate.name}</strong></span><b>Изменить</b></button></div>
      <article className="workout-card"><div className="card-top"><span className="tag">СЕГОДНЯ</span><span className="duration">≈ {Math.max(35,activeTemplate.exercises.length*15)} мин</span></div><h2>{activeTemplate.name}</h2><p>{activeTemplate.subtitle}</p>
        <div className="exercise-preview">{activeTemplate.exercises.slice(0,4).map((e,i)=><div key={e.id}><b>{String(i+1).padStart(2,"0")}</b><span>{e.name}<small>{e.sets.length} подхода</small></span></div>)}</div>
        <button className="primary" disabled={!activeTemplate.exercises.length} onClick={()=>{setExercises(cloneExercises(activeTemplate.exercises));setStarted(true);setTab("workout")}}>Начать тренировку <span>→</span></button>
      </article>
      <div className="section-title"><h3>Этот месяц</h3><button onClick={()=>setTab("progress")}>Подробнее</button></div><div className="stats"><div><strong>{monthSessions.length}</strong><span>тренировки</span></div><div><strong>{(monthVolume/1000).toFixed(1)}<small>т</small></strong><span>объём</span></div><div><strong>{records.length}</strong><span>рекорды</span></div></div>
      <div className="home-shortcuts">
        <button onClick={()=>setCatalogOpen(true)}><span>80</span><strong>Упражнения</strong><small>Техника и поиск</small></button>
        <button onClick={()=>setTab("progress")}><span>↗</span><strong>Прогресс</strong><small>Рекорды и замеры</small></button>
        <button onClick={()=>setTab("history")}><span>◷</span><strong>История</strong><small>Календарь и отчёт</small></button>
      </div>
    </section>}

    {tab==="workout"&&<section className="screen"><div className="workout-head"><div><div className="eyebrow">ТРЕНИРОВКА В ПРОЦЕССЕ</div><h1>{activeTemplate.name}</h1></div><div className="timer">{fmt(seconds)}<small>{doneSets} / {allSets.length} подходов</small></div></div>
      <div className="progress-line"><span style={{width:`${allSets.length?(doneSets/allSets.length)*100:0}%`}}/></div>
      {rest>0&&<div className="rest"><span>Отдых</span><strong>{fmt(rest)}</strong><button onClick={()=>setRest(0)}>Пропустить</button></div>}
      <div className="exercise-list">{exercises.map((ex,exIndex)=><article className="exercise" key={ex.id}><div className="exercise-title"><div><span>{ex.muscle}</span><h2>{ex.name}</h2></div><select aria-label={`Отдых ${ex.name}`} value={ex.restSeconds} onChange={e=>setExercises(items=>items.map(x=>x.id===ex.id?{...x,restSeconds:Number(e.target.value)}:x))}><option value="60">60 с</option><option value="90">90 с</option><option value="120">2 мин</option><option value="180">3 мин</option></select></div>
        {previousByName(ex.name)&&<div className="previous">Прошлый раз: {previousByName(ex.name)?.sets.map(s=>`${s.weight}×${s.reps}`).join(" · ")}</div>}
        {recommendation(ex.name)&&<div className="recommendation"><span>Рекомендация сегодня</span><strong>{recommendation(ex.name)}</strong><button onClick={()=>fillPrevious(ex.id,ex.name)}>Заполнить как раньше</button></div>}
        <div className="exercise-tools"><button disabled={exIndex===0} onClick={()=>moveExercise(exIndex,-1)}>↑</button><button disabled={exIndex===exercises.length-1} onClick={()=>moveExercise(exIndex,1)}>↓</button><button onClick={()=>removeExercise(ex.id)}>Удалить упражнение</button></div>
        <div className="set-head"><span>ПОДХОД</span><span>КГ</span><span>ПОВТ.</span><span/></div>
        {ex.sets.map((s,i)=><div className={`set-row ${s.done?"complete":""}`} key={s.id}><button className="set-number" aria-label={`Удалить подход ${i+1}`} onClick={()=>removeSet(ex.id,s.id)}>{i+1}<small>×</small></button><input aria-label={`Вес ${ex.name} ${i+1}`} type="number" value={s.weight} onChange={e=>updateSet(ex.id,s.id,"weight",Number(e.target.value))}/><input aria-label={`Повторения ${ex.name} ${i+1}`} type="number" value={s.reps} onChange={e=>updateSet(ex.id,s.id,"reps",Number(e.target.value))}/><button aria-label={`${s.done?"Отменить":"Завершить"} ${ex.name} ${i+1}`} className="check" onClick={()=>toggleSet(ex.id,s.id)}><Icon name="check"/></button></div>)}
        <button className="add-set" onClick={()=>setExercises(items=>items.map(x=>x.id===ex.id?{...x,sets:[...x.sets,{...x.sets[x.sets.length-1],id:Date.now(),done:false}]}:x))}>+ Добавить подход</button>
      </article>)}</div>
      <button className="add-exercise" onClick={()=>setCatalogOpen(true)}><Icon name="plus"/> Каталог упражнений</button><button className="finish" disabled={!doneSets} onClick={finishWorkout}>Завершить тренировку</button>
    </section>}

    {tab==="progress"&&<section className="screen"><div className="eyebrow">АНАЛИТИКА</div><h1>Твой <em>прогресс.</em></h1>
      <div className="big-stat"><span>Объём за всё время</span><strong>{(allTimeVolume/1000).toFixed(1)} т</strong><small>Этот месяц: {(monthVolume/1000).toFixed(1)} т · {monthSessions.length} тренировок</small></div>
      <article className="chart-card"><div className="section-title"><h3>Объём тренировок</h3><span>последние {chart.length}</span></div><div className="bars">{chart.map((v,i)=><div key={i}><span style={{height:`${Math.max(15,(v/Math.max(...chart,1))*100)}%`}}/><small>Т{i+1}</small></div>)}</div></article>
      <div className="records"><div className="section-title"><h3>Личные рекорды</h3><span>{records.length} всего · расчётный 1ПМ</span></div>{records.length?records.slice(0,6).map(([n,r])=><div key={n}><span>{n}<small>Лучший вес {r.weight} кг</small></span><strong>{r.oneRm} кг</strong></div>):<p className="empty">Завершите тренировку, чтобы увидеть рекорды.</p>}</div>
      <div className="section-title"><h3>Замеры тела</h3><button onClick={()=>setMeasurementOpen(true)}>+ Добавить</button></div>
      <div className="measurements">{state.measurements.length?state.measurements.slice(0,6).map(m=><article key={m.id}>{m.photo&&<img src={m.photo} alt={`Прогресс ${m.iso}`}/>}<div><strong>{m.weight||"—"} кг</strong><span>{formatDate(m.iso)}</span><small>Талия {m.waist||"—"} · Грудь {m.chest||"—"} · Рука {m.arm||"—"}</small></div></article>):<button className="empty-card" onClick={()=>setMeasurementOpen(true)}>Добавьте первый замер и фото прогресса</button>}</div>
    </section>}

    {tab==="history"&&<section className="screen report-page"><div className="eyebrow">ЖУРНАЛ</div><h1>История<br/><em>тренировок.</em></h1>
      <article className="calendar"><div className="section-title"><h3>{new Intl.DateTimeFormat("ru",{month:"long",year:"numeric"}).format(new Date())}</h3><span>{trainedDays.size} дней</span></div><div className="weekdays">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=><b key={x}>{x}</b>)}</div><div className="calendar-grid">{calendarDays.map((d,i)=><span key={i} className={d&&trainedDays.has(d)?"trained":""}>{d||""}</span>)}</div></article>
      <div className="report-actions"><select aria-label="Период отчёта" value={reportPeriod} onChange={e=>setReportPeriod(e.target.value as "week"|"month")}><option value="week">7 дней</option><option value="month">30 дней</option></select><button onClick={exportCsv}>CSV</button><button onClick={()=>window.print()}>PDF / печать</button></div>
      <div className="print-summary"><h2>Отчёт IronTrack</h2><p>{reportPeriod==="week"?"Последние 7 дней":"Последние 30 дней"} · {reportSessions.length} тренировок · {(reportSessions.reduce((s,x)=>s+x.volume,0)/1000).toFixed(1)} т</p></div>
      <div className="history-list">{state.history.map(s=><article key={s.id}><button className="date-box" onClick={()=>editSessionDate(s)} aria-label={`Изменить дату ${s.title}`}><b>{s.date.split(" ")[0]}</b><span>{s.date.split(" ")[1]}</span></button><div><h3>{s.title}</h3><p>{s.duration} мин · {(s.volume/1000).toFixed(1)} т объёма</p>{s.exercises&&<small>{s.exercises.map(e=>e.name).join(" · ")}</small>}</div><button className="history-delete" onClick={()=>deleteSession(s.id)} aria-label={`Удалить ${s.title}`}>×</button></article>)}</div>
    </section>}

    <nav>{([["home","home","Главная"],["workout","dumbbell","Тренировка"],["progress","chart","Прогресс"],["history","history","История"]] as const).map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
  </main>;
}
